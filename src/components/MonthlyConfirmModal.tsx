import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  X,
} from 'lucide-react';
import {
  checkDuplicateBankDetails,
  DuplicateBankCheckResult,
  submitMonthlyBankConfirmation,
  validateConfirmationWritePermission,
  WritePermissionCheckResult,
} from '../services/ledgerService';
import {
  ACCOUNT_TYPES,
  AccountType,
  ActionKind,
  AgentRecord,
  FIELD_LIMITS,
  MonthlyConfirmation,
  ProcessedUploadFile,
  UserAccount,
} from '../types';
import {
  formatCycleLabel,
  getAgentFullName,
  getCutoffStatus,
} from '../utils/cycleUtils';
import { processUploadFile } from '../utils/fileUtils';

interface MonthlyConfirmModalProps {
  agent: AgentRecord;
  cycleMonth: string;
  existingConfirmation?: MonthlyConfirmation | null;
  actor: UserAccount;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function MonthlyConfirmModal({
  agent,
  cycleMonth,
  existingConfirmation,
  actor,
  onClose,
  onSuccess,
}: MonthlyConfirmModalProps) {
  const cutoff = getCutoffStatus(cycleMonth);
  const fullName = getAgentFullName(agent);

  const [mode, setMode] = useState<ActionKind>('confirmed_existing');
  const [bankNameAndCode, setBankNameAndCode] = useState(
    existingConfirmation?.bankNameAndCode || agent.bankNameAndCode,
  );
  const [accountHolderName, setAccountHolderName] = useState(
    existingConfirmation?.accountHolderName || agent.accountHolderName,
  );
  const [accountType, setAccountType] = useState<AccountType>(
    existingConfirmation?.accountType || agent.accountType,
  );
  const [accountNumber, setAccountNumber] = useState(
    existingConfirmation?.accountNumber || agent.accountNumber,
  );
  const [bankFile, setBankFile] = useState<ProcessedUploadFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [permissionCheck, setPermissionCheck] =
    useState<WritePermissionCheckResult | null>(null);
  const [checkingDuplicateBank, setCheckingDuplicateBank] = useState(false);
  const [duplicateBankResult, setDuplicateBankResult] =
    useState<DuplicateBankCheckResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setCheckingAuth(true);
    void validateConfirmationWritePermission(
      agent,
      cycleMonth,
      existingConfirmation,
      actor,
    ).then((result) => {
      if (!active) return;
      setPermissionCheck(result);
      setCheckingAuth(false);
      if (!result.allowed && result.reason) {
        setError(result.reason);
      }
    });
    return () => {
      active = false;
    };
  }, [agent, cycleMonth, existingConfirmation, actor]);

  useEffect(() => {
    if (mode !== 'updated_banking') {
      setDuplicateBankResult(null);
      setCheckingDuplicateBank(false);
      return;
    }
    const trimmed = accountNumber.trim();
    if (trimmed.length < 4) {
      setDuplicateBankResult(null);
      setCheckingDuplicateBank(false);
      return;
    }

    let active = true;
    setCheckingDuplicateBank(true);
    const timer = window.setTimeout(() => {
      void checkDuplicateBankDetails(bankNameAndCode, trimmed, {
        excludeAgentId: agent.agentId,
        actorRole: actor.role,
        teamLeaderName: actor.teamLeaderName,
        includeCollectionScan:
          actor.role === 'admin' || actor.role === 'team_leader',
      })
        .then((res) => {
          if (!active) return;
          setDuplicateBankResult(res);
          setCheckingDuplicateBank(false);
        })
        .catch(() => {
          if (!active) return;
          setCheckingDuplicateBank(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    mode,
    bankNameAndCode,
    accountNumber,
    agent.agentId,
    actor.role,
    actor.teamLeaderName,
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (
      agent.idDocName &&
      file.name.trim().toLowerCase() === agent.idDocName.trim().toLowerCase()
    ) {
      setError(
        `Flagged: "${file.name}" matches your ID / Passport file name. File names cannot be the same — please upload a distinct bank statement file.`,
      );
      return;
    }

    setUploadingFile(true);
    setError('');
    try {
      const processed = await processUploadFile(file);
      setBankFile(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid file selected.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      !bankNameAndCode.trim() ||
      !accountHolderName.trim() ||
      accountNumber.trim().length < 4
    ) {
      setError(
        'Please complete Bank name and code, Account holder name, and Account number.',
      );
      return;
    }

    const bankingDetailsChanged =
      bankNameAndCode.trim() !==
        (existingConfirmation?.bankNameAndCode || agent.bankNameAndCode).trim() ||
      accountHolderName.trim() !==
        (
          existingConfirmation?.accountHolderName || agent.accountHolderName
        ).trim() ||
      accountType !== (existingConfirmation?.accountType || agent.accountType) ||
      accountNumber.trim() !==
        (existingConfirmation?.accountNumber || agent.accountNumber).trim();

    if (
      mode === 'updated_banking' &&
      !bankFile &&
      (!existingConfirmation?.bankDocId || bankingDetailsChanged)
    ) {
      setError(
        `Please upload a bank statement or bank confirmation letter for ${cycleMonth} (required when updating banking details).`,
      );
      return;
    }

    if (permissionCheck && !permissionCheck.allowed) {
      setError(
        permissionCheck.reason ||
          `You are not authorized to write to ${permissionCheck.path}.`,
      );
      return;
    }

    if (mode === 'updated_banking') {
      setCheckingDuplicateBank(true);
      try {
        const dup = await checkDuplicateBankDetails(
          bankNameAndCode,
          accountNumber,
          {
            excludeAgentId: agent.agentId,
            actorRole: actor.role,
            teamLeaderName: actor.teamLeaderName,
            includeCollectionScan:
              actor.role === 'admin' || actor.role === 'team_leader',
          },
        );
        setDuplicateBankResult(dup);
        if (dup.isDuplicate) {
          setError(
            dup.reason ||
              'Duplicate bank details detected: this account number is already registered in the added banks.',
          );
          return;
        }
      } finally {
        setCheckingDuplicateBank(false);
      }
    }

    setSubmitting(true);
    try {
      await submitMonthlyBankConfirmation(
        {
          agent,
          cycleMonth,
          actionKind: mode,
          bankNameAndCode,
          accountHolderName,
          accountType,
          accountNumber,
          bankFile: mode === 'updated_banking' ? bankFile : null,
          existingConfirmation:
            permissionCheck?.liveConfirmation ?? existingConfirmation,
        },
        actor,
      );
      onSuccess(
        cutoff.isAfterCutoff
          ? `Banking confirmation saved for ${agent.cerebusAgentCode} (${cycleMonth}) and flagged as post-cutoff for Admin review.`
          : `Banking confirmation saved on time for ${agent.cerebusAgentCode} (${cycleMonth}).`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit monthly banking confirmation.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Monthly Banking Confirmation · {formatCycleLabel(cycleMonth)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono tabular-nums">
                {agent.cerebusAgentCode}
              </span>{' '}
              · {fullName} · Cutoff {cutoff.cutoffDateStr} (5 days before{' '}
              {cutoff.payoutDateStr})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {cutoff.isAfterCutoff ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-900 space-y-0.5">
                <p className="font-semibold">
                  Late Submission Window (Past {cutoff.cutoffDateStr} Cutoff)
                </p>
                <p>
                  This update is permitted, and will automatically be flagged as{' '}
                  <span className="font-medium">Late · Flagged for Review</span>{' '}
                  in the Admin verification queue.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-900 space-y-0.5">
                <p className="font-semibold">
                  On-Time Window ({cutoff.statusHeadline})
                </p>
                <p>{cutoff.statusDetail}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Confirmation Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('confirmed_existing');
                  setBankFile(null);
                  setError('');
                  setBankNameAndCode(agent.bankNameAndCode);
                  setAccountHolderName(agent.accountHolderName);
                  setAccountType(agent.accountType);
                  setAccountNumber(agent.accountNumber);
                }}
                className={`p-3.5 text-left border rounded-lg transition-colors cursor-pointer ${
                  mode === 'confirmed_existing'
                    ? 'border-blue-700 bg-blue-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  Confirm Existing Banking
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attest no banking changes for {cycleMonth} — no bank statement upload needed.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('updated_banking')}
                className={`p-3.5 text-left border rounded-lg transition-colors cursor-pointer ${
                  mode === 'updated_banking'
                    ? 'border-blue-700 bg-blue-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  Change / Update Banking
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit new account details and upload updated bank proof for {cycleMonth}.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bank name and code
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.bankNameAndCode}
                disabled={mode === 'confirmed_existing'}
                value={bankNameAndCode}
                onChange={(e) => setBankNameAndCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account holder name
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.accountHolderName}
                disabled={mode === 'confirmed_existing'}
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account type
              </label>
              <select
                disabled={mode === 'confirmed_existing'}
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account number
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.accountNumber}
                disabled={mode === 'confirmed_existing'}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 ${
                  mode === 'updated_banking' && duplicateBankResult?.isDuplicate
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-blue-600'
                }`}
              />
            </div>
          </div>

          {mode === 'updated_banking' && checkingDuplicateBank && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Checking added banks for duplicate account number...</span>
            </div>
          )}

          {mode === 'updated_banking' &&
            !checkingDuplicateBank &&
            duplicateBankResult?.isDuplicate && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Duplicate bank detected:</span>{' '}
                  {duplicateBankResult.reason}
                </div>
              </div>
            )}

          {mode === 'updated_banking' &&
            !checkingDuplicateBank &&
            duplicateBankResult &&
            !duplicateBankResult.isDuplicate &&
            duplicateBankResult.bankKey && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  No duplicate found — this bank account number is unique in the ledger.
                </span>
              </div>
            )}

          {mode === 'updated_banking' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Upload bank statement for {cycleMonth}{' '}
                <span className="text-red-600">*</span>
              </label>
              <label className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileUp className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">
                    {uploadingFile
                      ? 'Processing file...'
                      : bankFile
                        ? bankFile.fileName
                        : existingConfirmation?.bankDocName
                          ? `Current: ${existingConfirmation.bankDocName} (click to replace)`
                          : 'Select PDF, PNG, or JPG bank document'}
                  </span>
                </div>
                <span className="text-xs font-medium text-blue-700 whitespace-nowrap shrink-0">
                  Browse File
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                uploadingFile ||
                checkingAuth ||
                (permissionCheck !== null && !permissionCheck.allowed) ||
                (mode === 'updated_banking' &&
                  (checkingDuplicateBank ||
                    Boolean(duplicateBankResult?.isDuplicate)))
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {(submitting || checkingAuth) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <span>
                {checkingAuth
                  ? 'Verifying Access...'
                  : mode === 'updated_banking'
                    ? `Submit Updated Banking (${cycleMonth})`
                    : `Confirm Banking (${cycleMonth})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
