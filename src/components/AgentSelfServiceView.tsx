import React, { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  History,
  KeyRound,
  Loader2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  AgentRecord,
  AuditLogEntry,
  MonthlyConfirmation,
  UserAccount,
} from '../types';
import {
  formatTimestamp,
  getAgentFullName,
  maskAccountNumber,
  toMillis,
} from '../utils/cycleUtils';
import { AgentFormModal } from './AgentFormModal';
import { ExpandedPhotoTarget } from './PhotoLightboxModal';
import { VerificationStatusLabel } from './StatusLabel';

interface AgentSelfServiceViewProps {
  agent: AgentRecord | null;
  confirmations: MonthlyConfirmation[];
  auditLogs: AuditLogEntry[];
  activeCycle: string;
  actor: UserAccount;
  onEditPersonal: (agent: AgentRecord) => void;
  onConfirmBanking: (
    agent: AgentRecord,
    cycleMonth: string,
    existingConf?: MonthlyConfirmation | null,
  ) => void;
  onPreviewDoc: (docId: string, title: string) => void;
  onExpandPhoto: (photo: ExpandedPhotoTarget) => void;
  onToast: (message: string) => void;
}

export function AgentSelfServiceView({
  agent,
  confirmations,
  auditLogs,
  activeCycle,
  actor,
  onEditPersonal,
  onConfirmBanking,
  onPreviewDoc,
  onExpandPhoto,
  onToast,
}: AgentSelfServiceViewProps) {
  const [revealAcct, setRevealAcct] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setPwError('No active session found. Please sign in again.');
      return;
    }
    setSavingPw(true);
    try {
      await updatePassword(fbUser, newPassword);
      setPwModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onToast('Your portal password has been updated.');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/requires-recent-login' && fbUser.email) {
        if (!currentPassword) {
          setPwError('Please enter your current/temporary password to confirm.');
          setSavingPw(false);
          return;
        }
        try {
          const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
          await reauthenticateWithCredential(fbUser, cred);
          await updatePassword(fbUser, newPassword);
          setPwModalOpen(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          onToast('Your portal password has been updated.');
        } catch (reauthErr) {
          setPwError(
            reauthErr instanceof Error
              ? reauthErr.message
              : 'Current password verification failed.',
          );
        }
      } else {
        setPwError(
          err instanceof Error ? err.message : 'Unable to update password.',
        );
      }
    } finally {
      setSavingPw(false);
    }
  };

  if (!agent) {
    return (
      <div className="max-w-4xl mx-auto">
        <AgentFormModal
          mode="create"
          activeCycle={activeCycle}
          actor={actor}
          selfSignup={true}
          onSuccess={onToast}
        />
      </div>
    );
  }

  const fullName = getAgentFullName(agent);
  const agentConfirmations = confirmations
    .filter((c) => c.agentId === agent.agentId)
    .sort((a, b) => b.cycleMonth.localeCompare(a.cycleMonth));
  const activeConf =
    agentConfirmations.find((c) => c.cycleMonth === activeCycle) || null;
  const isVerified = activeConf?.verificationStatus === 'verified';
  const isConfirmed =
    activeConf?.verificationStatus === 'confirmed' ||
    activeConf?.verificationStatus === 'late_flagged';
  const isRejected = activeConf?.verificationStatus === 'rejected';
  const confirmedAtLabel = activeConf
    ? formatTimestamp(activeConf.updatedAt || activeConf.submittedAt)
    : '';
  const agentLogs = auditLogs
    .filter((l) => l.agentId === agent.agentId)
    .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));

  return (
    <div className="space-y-6">
      {/* Monthly Confirmation Action Banner */}
      <div
        className={`border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isVerified
            ? 'border-emerald-200 bg-emerald-50/40'
            : isConfirmed
              ? 'border-emerald-200 bg-white'
              : isRejected
                ? 'border-red-200 bg-red-50/40'
                : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-start gap-3.5">
          {isVerified ? (
            <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-emerald-700" />
          ) : isConfirmed ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-700" />
          ) : isRejected ? (
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-700" />
          ) : (
            <CalendarClock className="w-5 h-5 mt-0.5 shrink-0 text-blue-700" />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <VerificationStatusLabel
                status={activeConf?.verificationStatus || 'pending'}
                isLateAfterCutoff={activeConf?.isLateAfterCutoff}
              />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {isVerified
                ? 'Your banking details are confirmed and verified.'
                : isConfirmed
                  ? 'Banking Details Confirmed'
                  : isRejected
                    ? 'Banking Confirmation Needs Correction'
                    : 'Confirm Your Banking Details'}
            </h2>
            <p className="text-xs text-slate-600">
              {isVerified
                ? `Verified${activeConf?.verifiedByName ? ` by ${activeConf.verifiedByName}` : ''}. No further action is required unless your bank account changes.`
                : isConfirmed
                  ? `Confirmed ${confirmedAtLabel !== '—' ? `on ${confirmedAtLabel}` : 'on record'} (${activeConf?.actionKind === 'updated_banking' ? 'updated bank details submitted' : 'existing bank details attested'}) · Queued for Admin verification.`
                  : isRejected
                    ? 'Please review the reviewer note below and resubmit your banking details.'
                    : 'Please confirm that your registered banking details are accurate or submit updated bank details.'}
            </p>
            {activeConf?.reviewerNotes && (
              <p className="text-xs font-medium text-red-700 pt-0.5">
                Reviewer Note: {activeConf.reviewerNotes}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPwError('');
              setPwModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={() => onEditPersonal(agent)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Update Personal Info & Docs</span>
          </button>

          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-200 rounded-lg whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Banking Confirmed & Verified</span>
            </span>
          ) : isConfirmed ? (
            <button
              type="button"
              onClick={() => onConfirmBanking(agent, activeCycle, activeConf)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Confirmed · Edit Banking</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onConfirmBanking(agent, activeCycle, activeConf)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>
                {isRejected
                  ? 'Update & Confirm Banking'
                  : 'Confirm / Update Banking'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Personal & Banking Dossier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {agent.photoThumbUrl || agent.photoDocId ? (
                <button
                  type="button"
                  onClick={() =>
                    onExpandPhoto({
                      title: fullName,
                      subtitle: `${agent.cerebusAgentCode} · ${agent.geographicArea}`,
                      docId: agent.photoDocId,
                      fallbackThumbUrl: agent.photoThumbUrl,
                      fileName: agent.photoDocName,
                    })
                  }
                  title="Click to expand whole profile picture"
                  className="rounded-full overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0812B8] transition-all"
                >
                  {agent.photoThumbUrl ? (
                    <img
                      src={agent.photoThumbUrl}
                      alt={fullName}
                      className="w-12 h-12 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 flex items-center justify-center text-slate-500">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </button>
              ) : (
                <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">
                  {fullName}
                </h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums truncate">
                  {agent.cerebusAgentCode} · {agent.geographicArea} · TL:{' '}
                  {agent.cerebusTeamLeader}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
              Updated {formatTimestamp(agent.updatedAt)}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Email Address</dt>
              <dd className="text-slate-900 break-all">{agent.emailAddress}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Contact Email</dt>
              <dd className="text-slate-900 break-all">{agent.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Nationality</dt>
              <dd className="text-slate-900">{agent.nationality}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">
                {agent.idDocumentType} Number
              </dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {agent.idPassportNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Cellphone / WhatsApp</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {agent.cellphoneNumber} / {agent.whatsappNumber || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">T-Shirt Kit</dt>
              <dd className="text-slate-900">
                {agent.tShirtStyle} · {agent.tShirtSize}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Your comments</dt>
              <dd className="text-slate-700">
                {agent.yourComments || 'No comments'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  Registered Bank Account
                </h3>
                {(isConfirmed || isVerified) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Confirmed</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRevealAcct((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer shrink-0"
              >
                {revealAcct ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Reveal
                  </>
                )}
              </button>
            </div>

            {isVerified ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Banking Details Confirmed & Verified
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    Verified on file
                    {confirmedAtLabel && confirmedAtLabel !== '—'
                      ? ` · Confirmed ${confirmedAtLabel}`
                      : ''}
                    .
                  </p>
                </div>
              </div>
            ) : isConfirmed ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Banking Details Confirmed
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    {activeConf?.actionKind === 'updated_banking'
                      ? 'Updated banking details submitted'
                      : 'Existing banking details confirmed'}
                    {confirmedAtLabel && confirmedAtLabel !== '—'
                      ? ` · ${confirmedAtLabel}`
                      : ''}
                  </p>
                </div>
              </div>
            ) : isRejected ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-900">
                <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Correction Required
                  </p>
                  <p className="text-red-800 mt-0.5">
                    {activeConf?.reviewerNotes ||
                      'Please update and reconfirm your banking details.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                <CalendarClock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Pending Banking Confirmation
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    Click Confirm / Update Banking above to confirm your bank account.
                  </p>
                </div>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Bank & Code</dt>
                <dd className="font-medium text-slate-900">
                  {agent.bankNameAndCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Account Holder</dt>
                <dd className="font-medium text-slate-900">
                  {agent.accountHolderName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Account Type</dt>
                <dd className="text-slate-900">{agent.accountType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Account Number</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">
                  {revealAcct
                    ? agent.accountNumber
                    : maskAccountNumber(agent.accountNumber)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3">
              Your Compliance Documents
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700 truncate">
                  Face Photo: {agent.photoDocName || 'Not uploaded'}
                </span>
                {(agent.photoDocId || agent.photoThumbUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      onExpandPhoto({
                        title: fullName,
                        subtitle: `${agent.cerebusAgentCode} · Face Photo`,
                        docId: agent.photoDocId,
                        fallbackThumbUrl: agent.photoThumbUrl,
                        fileName: agent.photoDocName,
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Expand
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700 truncate">
                  ID / Passport: {agent.idDocName || 'Not uploaded'}
                </span>
                {agent.idDocId && (
                  <button
                    type="button"
                    onClick={() => onPreviewDoc(agent.idDocId!, 'ID / Passport')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Preview
                  </button>
                )}
              </div>
              {activeConf?.bankDocId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 truncate">
                    Bank Proof: {activeConf.bankDocName}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewDoc(activeConf.bankDocId!, 'Bank Proof')
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Change History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Your Dossier Change Log
          </h3>
        </div>
        {agentLogs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No changes logged yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {agentLogs.map((log) => (
              <div
                key={log.logId}
                className="px-5 py-3.5 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-slate-800">{log.summary}</p>
                  <p className="text-xs text-slate-500">
                    By {log.actorName} ({log.actorRole.replace('_', ' ')})
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pwModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0812B8]" />
                <h3 className="text-base font-semibold text-slate-900">
                  Update Portal Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPwModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Replace your temporary password with a personal password (at least 6 characters).
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Current / Temporary Password (if prompted)
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirm New Password <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              {pwError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {pwError}
                </div>
              )}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {savingPw && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save New Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
