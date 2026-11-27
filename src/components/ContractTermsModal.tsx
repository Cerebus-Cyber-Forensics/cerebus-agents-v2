import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  FileSignature,
  Loader2,
  X,
} from 'lucide-react';

interface ContractTermsModalProps {
  open: boolean;
  submitting: boolean;
  agentCode: string;
  fullName: string;
  idPassportNumber: string;
  geographicArea: string;
  teamLeader: string;
  bankNameAndCode: string;
  accountType: string;
  accountNumber: string;
  cycleMonth: string;
  onCancel: () => void;
  onAccept: () => void;
}

export function ContractTermsModal({
  open,
  submitting,
  agentCode,
  fullName,
  idPassportNumber,
  geographicArea,
  teamLeader,
  bankNameAndCode,
  accountType,
  accountNumber,
  cycleMonth,
  onCancel,
  onAccept,
}: ContractTermsModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setHasScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setHasScrolledToBottom(false);
      return;
    }
    const timer = window.setTimeout(checkScroll, 50);
    window.addEventListener('resize', checkScroll);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [open, checkScroll]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-terms-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0812B8]/10 text-[#0812B8] flex items-center justify-center shrink-0">
              <FileSignature className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="contract-terms-title"
                className="text-base font-semibold text-slate-900 truncate"
              >
                Contract and Terms and Conditions
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Cerebus Cyber Forensics · Agent Code{' '}
                <span className="font-mono font-medium text-slate-700">
                  {agentCode || 'NEW'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            aria-label="Close Contract and Terms and Conditions"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Contract Body */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed bg-slate-50/40"
        >
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-1.5">
            <p className="font-semibold text-slate-900 uppercase tracking-wide text-[11px]">
              Contracting Agent Summary
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <div>
                <span className="text-slate-400">Full Name:</span>{' '}
                <span className="font-medium text-slate-900">
                  {fullName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">ID / Passport:</span>{' '}
                <span className="font-mono text-slate-900">
                  {idPassportNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Geographic Area:</span>{' '}
                <span className="font-medium text-slate-900">
                  {geographicArea || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Team Leader:</span>{' '}
                <span className="font-medium text-slate-900">
                  {teamLeader || '—'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400">Payout Account:</span>{' '}
                <span className="font-mono text-slate-900">
                  {bankNameAndCode} · {accountType} · {accountNumber}
                </span>
              </div>
            </div>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              1. Engagement & Independent Contractor Status
            </h3>
            <p>
              By accepting this Agreement, the undersigned Agent ({fullName}) agrees to perform field operations and reporting services on behalf of Cerebus Cyber Forensics under the supervision of the assigned Cerebus Team Leader ({teamLeader || 'Operations'}) within the designated geographic area ({geographicArea || 'Assigned Region'}). This Agreement does not constitute permanent employment unless governed by a separate signed employment contract.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              2. Banking Details Confirmation & Verification
            </h3>
            <p>
              To ensure accurate disbursements, you must confirm your existing banking details or submit updated banking details and bank confirmation proof in the portal whenever your payout account changes.
            </p>
            <p>
              All submitted banking updates undergo Admin verification prior to payout processing.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              3. Accuracy of Banking Details & Indemnity
            </h3>
            <p>
              You certify that the nominated bank account ({bankNameAndCode}, {accountType}, Account Number {accountNumber}) is active, valid, and registered accurately. Cerebus Cyber Forensics relies strictly on the account details confirmed in this ledger and accepts no liability for delayed, misdirected, or rejected electronic funds transfers resulting from inaccurate or outdated banking information provided by the Agent.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              4. Compliance Documentation & Verification
            </h3>
            <p>
              You warrant that all uploaded identification documents (ID/Passport), signed contract copies, and bank confirmation statements are genuine, legible, and current. Any material alteration or submission of falsified documentation will result in immediate suspension of banking verification and termination of your Cerebus agent code ({agentCode}).
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              5. Confidentiality, Uniform Standards & Data Audit Trail
            </h3>
            <p>
              All operational protocols, client details, team rosters, and payout records accessed or handled in connection with Cerebus Cyber Forensics are strictly confidential. You further consent to the processing and retention of your personal onboarding details, uniform kit sizing, compliance documents, and an immutable forensic audit trail recording all profile and banking modifications.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              6. Digital Execution & Binding Acceptance
            </h3>
            <p>
              By clicking <strong>Accept & Submit</strong> below, you acknowledge that you have read this entire Contract and Terms and Conditions, confirm that all submitted information is true and complete, and agree that your electronic acceptance carries the same binding legal effect as a handwritten signature.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs flex items-center gap-2">
            {hasScrolledToBottom ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Contract reviewed — ready to accept</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <ArrowDown className="w-4 h-4 shrink-0 animate-bounce" />
                <span>Scroll down to the bottom to enable Accept</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Back to Form
            </button>
            <button
              type="button"
              disabled={!hasScrolledToBottom || submitting}
              onClick={onAccept}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Submitting...' : 'Accept & Submit'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
