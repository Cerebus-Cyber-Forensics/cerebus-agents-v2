import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  KeyRound,
  PlusCircle,
} from 'lucide-react';
import { GeneratedAgentCredentials } from '../types';
import { getCurrentCycleMonth } from '../utils/cycleUtils';
import { AgentFormModal } from './AgentFormModal';

interface SubmittedReceipt {
  agentId: string;
  agentCode: string;
  fullName: string;
  cycleMonth: string;
  isLateAfterCutoff: boolean;
  credentials?: GeneratedAgentCredentials | null;
}

export function InviteSignupPortal() {
  const [submittedReceipt, setSubmittedReceipt] =
    useState<SubmittedReceipt | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [copiedField, setCopiedField] = useState<string>('');

  const inviteParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const tl = params.get('tl')?.trim() || '';
    const area = params.get('area')?.trim() || '';
    const rawCycle = params.get('cycle')?.trim() || '';
    const cycle = /^\d{6}$/.test(rawCycle) ? rawCycle : getCurrentCycleMonth();
    return { tl, area, cycle };
  }, []);

  const copyValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(''), 2200);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const portalLoginUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal Branded Header — Form Only, No Sign-In or Dashboard Navigation */}
      <header className="w-full border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_3b1feb10.png"
              alt="Cerebus Cyber Forensics"
              referrerPolicy="no-referrer"
              className="h-9 w-auto object-contain shrink-0"
            />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <span className="hidden sm:inline text-xs font-medium text-slate-600 truncate">
              Agent Onboarding Form
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {submittedReceipt ? (
          <div className="max-w-xl mx-auto mt-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-bold text-slate-900">
                  Agent Registration Submitted
                </h1>
                <p className="text-sm text-slate-600">
                  Your onboarding profile and compliance documents have been recorded and sent directly to the Cerebus Admin Dashboard.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Agent Name</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {submittedReceipt.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Cerebus Agent Code</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {submittedReceipt.agentCode}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Banking Status</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Banking Confirmed
                </span>
              </div>
            </div>

            {submittedReceipt.credentials && (
              <div className="bg-[#0B1120] text-white rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        Your Agent Portal Login Credentials
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Save these details now to log in later and confirm or update your banking details.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void copyValue(
                        'all',
                        `Portal URL: ${portalLoginUrl}\nUser Login: ${submittedReceipt.credentials?.loginUsername}\nTemp Password: ${submittedReceipt.credentials?.tempPassword}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#1420D8] rounded-md cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedField === 'all' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-slate-400 block">User Login</span>
                      <span className="font-mono font-semibold text-sm text-white break-all">
                        {submittedReceipt.credentials.loginUsername}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue(
                          'login',
                          submittedReceipt.credentials!.loginUsername,
                        )
                      }
                      aria-label="Copy User Login"
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer shrink-0"
                    >
                      {copiedField === 'login' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-slate-400 block">
                        Temporary Password
                      </span>
                      <span className="font-mono font-semibold text-sm text-amber-300 break-all">
                        {submittedReceipt.credentials.tempPassword}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue(
                          'password',
                          submittedReceipt.credentials!.tempPassword,
                        )
                      }
                      aria-label="Copy Temporary Password"
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer shrink-0"
                    >
                      {copiedField === 'password' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <span className="truncate">
                    Portal URL:{' '}
                    <span className="font-mono text-white">{portalLoginUrl}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyValue('url', portalLoginUrl)}
                    className="text-blue-300 hover:text-white font-medium cursor-pointer shrink-0"
                  >
                    {copiedField === 'url' ? 'Copied URL' : 'Copy URL'}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSubmittedReceipt(null);
                  setFormResetKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Submit Another Agent</span>
              </button>
            </div>
          </div>
        ) : (
          <AgentFormModal
            key={formResetKey}
            mode="create"
            publicSignup
            activeCycle={inviteParams.cycle}
            initialTeamLeader={inviteParams.tl}
            initialGeographicArea={inviteParams.area}
            onSuccess={() => {}}
            onSubmitted={(details) => setSubmittedReceipt(details)}
          />
        )}
      </main>

      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        Cerebus Cyber Forensics · Agent Onboarding Portal
      </footer>
    </div>
  );
}
