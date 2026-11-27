import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import { verifyOrRejectMonthlyPayment } from '../services/ledgerService';
import {
  AgentRecord,
  MonthlyConfirmation,
  UserAccount,
} from '../types';
import { formatTimestamp } from '../utils/cycleUtils';
import { downloadCsv } from '../utils/csvUtils';
import { VerificationStatusLabel } from './StatusLabel';

interface PaymentVerificationViewProps {
  agents: AgentRecord[];
  confirmations: MonthlyConfirmation[];
  activeCycle: string;
  actor: UserAccount;
  onPreviewDoc: (docId: string, title: string) => void;
  onSelectAgent: (agent: AgentRecord) => void;
  onToast: (message: string) => void;
}

type QueueFilter = 'needs_review' | 'verified' | 'rejected' | 'all';

export function PaymentVerificationView({
  agents,
  confirmations,
  activeCycle,
  actor,
  onPreviewDoc,
  onSelectAgent,
  onToast,
}: PaymentVerificationViewProps) {
  const [filter, setFilter] = useState<QueueFilter>('needs_review');
  const [notesByConf, setNotesByConf] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cycleConfs = useMemo(
    () =>
      confirmations
        .filter((c) => c.cycleMonth === activeCycle)
        .sort((a, b) => a.agentCode.localeCompare(b.agentCode)),
    [confirmations, activeCycle],
  );

  const filtered = useMemo(() => {
    return cycleConfs.filter((c) => {
      if (filter === 'needs_review') {
        return (
          c.verificationStatus === 'confirmed' ||
          c.verificationStatus === 'late_flagged'
        );
      }
      if (filter === 'all') return true;
      return c.verificationStatus === filter;
    });
  }, [cycleConfs, filter]);

  const verifiedList = useMemo(
    () => cycleConfs.filter((c) => c.verificationStatus === 'verified'),
    [cycleConfs],
  );

  const handleDecision = async (
    conf: MonthlyConfirmation,
    decision: 'verified' | 'rejected',
  ) => {
    setError('');
    const note = (notesByConf[conf.confirmationId] ?? conf.reviewerNotes ?? '').trim();
    if (decision === 'rejected' && !note) {
      setError(
        `Please enter a reviewer note explaining the correction needed for ${conf.agentCode}.`,
      );
      return;
    }
    setBusyId(conf.confirmationId);
    try {
      await verifyOrRejectMonthlyPayment(conf, decision, note, actor);
      onToast(
        decision === 'verified'
          ? `Verified ${conf.agentCode} (${conf.agentName}) for ${activeCycle} payout.`
          : `Flagged ${conf.agentCode} for correction.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update verification.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleExportFilteredCsv = () => {
    if (filtered.length === 0) return;

    const headers = [
      'Agent Code',
      'Agent Name',
      'Team Leader',
      'Geographic Area',
      'Email Address',
      'Cellphone',
      'Bank Name and Code',
      'Account Holder Name',
      'Account Type',
      'Account Number',
      'Confirmation Action',
      'Verification Status',
      'Submitted By',
      'Submitted At',
      'Bank Proof File',
      'Previous Bank Summary',
      'Verified By',
      'Verified At',
      'Reviewer Notes',
    ];

    const rows = filtered.map((c) => {
      const matchedAgent = agents.find((a) => a.agentId === c.agentId);
      const displayStatus =
        c.verificationStatus === 'late_flagged'
          ? 'confirmed'
          : c.verificationStatus;
      return [
        c.agentCode,
        c.agentName,
        c.cerebusTeamLeader,
        c.geographicArea,
        c.emailAddress,
        matchedAgent?.cellphoneNumber || '',
        c.bankNameAndCode,
        c.accountHolderName,
        c.accountType,
        c.accountNumber,
        c.actionKind,
        displayStatus,
        c.submittedByName,
        formatTimestamp(c.updatedAt || c.submittedAt),
        c.bankDocName || '',
        c.previousBankSummary || '',
        c.verifiedByName || '',
        c.verifiedAt || '',
        c.reviewerNotes || '',
      ];
    });

    downloadCsv(`cerebus_banking_verification_${filter}.csv`, headers, rows);
    onToast(
      `Exported ${filtered.length} ${filter.replace('_', ' ')} banking record(s) to CSV.`,
    );
  };

  const handleExportVerifiedBatch = () => {
    const headers = [
      'Agent Code',
      'Agent Name',
      'Team Leader',
      'Geographic Area',
      'Bank Name and Code',
      'Account Holder Name',
      'Account Type',
      'Account Number',
      'Verified By',
      'Verified At',
    ];

    const rows = verifiedList.map((c) => [
      c.agentCode,
      c.agentName,
      c.cerebusTeamLeader,
      c.geographicArea,
      c.bankNameAndCode,
      c.accountHolderName,
      c.accountType,
      c.accountNumber,
      c.verifiedByName || '',
      c.verifiedAt || '',
    ]);

    downloadCsv('cerebus_verified_banking.csv', headers, rows);
  };

  const counts = {
    needs_review: cycleConfs.filter(
      (c) =>
        c.verificationStatus === 'confirmed' ||
        c.verificationStatus === 'late_flagged',
    ).length,
    verified: verifiedList.length,
    rejected: cycleConfs.filter((c) => c.verificationStatus === 'rejected')
      .length,
    all: cycleConfs.length,
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              ['needs_review', `Needs Review (${counts.needs_review})`],
              ['verified', `Verified (${counts.verified})`],
              ['rejected', `Corrections (${counts.rejected})`],
              ['all', `All (${counts.all})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={handleExportFilteredCsv}
            title={`Export ${filtered.length} currently filtered record(s) for payroll`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to CSV</span>
          </button>

          <button
            type="button"
            disabled={verifiedList.length === 0}
            onClick={handleExportVerifiedBatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Verified Payouts ({verifiedList.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-900">
            No banking confirmations in this queue
          </p>
          <p className="text-xs text-slate-500">
            Switch filter tabs above or wait for agents to confirm their banking details.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conf) => {
            const matchedAgent = agents.find((a) => a.agentId === conf.agentId);
            const isBusy = busyId === conf.confirmationId;
            const noteVal =
              notesByConf[conf.confirmationId] ?? conf.reviewerNotes ?? '';

            return (
              <div
                key={conf.confirmationId}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                        {conf.agentCode}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      {matchedAgent ? (
                        <button
                          type="button"
                          onClick={() => onSelectAgent(matchedAgent)}
                          className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          {conf.agentName}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {conf.agentName}
                        </span>
                      )}
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs text-slate-500">
                        TL: {conf.cerebusTeamLeader}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs text-slate-500">
                        {conf.geographicArea}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>
                        {conf.actionKind === 'updated_banking'
                          ? 'Banking details changed'
                          : 'Confirmed existing banking'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Submitted {formatTimestamp(conf.updatedAt || conf.submittedAt)}
                      </span>
                    </div>
                  </div>

                  <VerificationStatusLabel
                    status={conf.verificationStatus}
                    isLateAfterCutoff={conf.isLateAfterCutoff}
                  />
                </div>

                {/* Banking comparison grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="md:col-span-4 space-y-1">
                    <p className="text-xs text-slate-500">Bank name and code</p>
                    <p className="text-sm font-medium text-slate-900">
                      {conf.bankNameAndCode}
                    </p>
                    <p className="text-xs text-slate-500">
                      Holder: {conf.accountHolderName}
                    </p>
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <p className="text-xs text-slate-500">Account & Type</p>
                    <p className="text-sm font-mono tabular-nums font-semibold text-slate-900">
                      {conf.accountNumber}
                    </p>
                    <p className="text-xs text-slate-500">{conf.accountType}</p>
                  </div>
                  <div className="md:col-span-4 space-y-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        Bank Proof Document
                      </p>
                      <p className="text-xs text-slate-700 truncate">
                        {conf.bankDocName ||
                          (conf.actionKind === 'confirmed_existing'
                            ? 'Existing banking confirmed (on file)'
                            : 'No statement uploaded')}
                      </p>
                    </div>
                    {conf.bankDocId ? (
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewDoc(
                            conf.bankDocId!,
                            `${conf.agentCode} Bank Proof`,
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline cursor-pointer self-start mt-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Inspect Bank Proof</span>
                      </button>
                    ) : (
                      matchedAgent?.latestBankDocId && (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewDoc(
                              matchedAgent.latestBankDocId!,
                              `${conf.agentCode} On-File Bank Proof`,
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline cursor-pointer self-start mt-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Inspect On-File Proof</span>
                        </button>
                      )
                    )}
                  </div>

                  {conf.previousBankSummary && (
                    <div className="md:col-span-12 pt-2 border-t border-slate-200 text-xs text-amber-800">
                      <span className="font-semibold">Previous Account: </span>
                      <span className="font-mono tabular-nums">
                        {conf.previousBankSummary}
                      </span>
                    </div>
                  )}
                </div>

                {/* Reviewer Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={noteVal}
                    onChange={(e) =>
                      setNotesByConf((prev) => ({
                        ...prev,
                        [conf.confirmationId]: e.target.value,
                      }))
                    }
                    placeholder="Reviewer notes (required if requesting correction)..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(conf, 'rejected')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Request Correction</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(conf, 'verified')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Verify for Payout</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
