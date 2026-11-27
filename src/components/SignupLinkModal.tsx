import { useMemo, useState } from 'react';
import { Check, Copy, Link2, X } from 'lucide-react';

interface SignupLinkModalProps {
  activeCycle: string;
  teamLeaderOptions: string[];
  onClose: () => void;
  onToast: (message: string) => void;
}

export function SignupLinkModal({
  teamLeaderOptions,
  onClose,
  onToast,
}: SignupLinkModalProps) {
  const [teamLeader, setTeamLeader] = useState('');
  const [geographicArea, setGeographicArea] = useState('');
  const [copied, setCopied] = useState(false);

  const signupUrl = useMemo(() => {
    const url = new URL(window.location.origin);
    url.searchParams.set('signup', 'agent');
    if (teamLeader.trim()) {
      url.searchParams.set('tl', teamLeader.trim());
    }
    if (geographicArea.trim()) {
      url.searchParams.set('area', geographicArea.trim());
    }
    return url.toString();
  }, [teamLeader, geographicArea]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      onToast('Copied agent signup link to clipboard.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      onToast('Select and copy the signup link manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0812B8]/10 text-[#0812B8] flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Agent Onboarding Signup Link
              </h2>
              <p className="text-xs text-slate-500">
                Recipients only see the Add Agent form; submissions appear live in your dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Shareable Form Link
            </label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={signupUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-900">
              Optional Pre-fill Parameters
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pre-fill Team Leader
                </label>
                <input
                  type="text"
                  list="cerebus-tl-suggestions"
                  value={teamLeader}
                  onChange={(e) => setTeamLeader(e.target.value)}
                  placeholder="Optional (e.g. Thabo Ndlovu)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="cerebus-tl-suggestions">
                  {teamLeaderOptions.map((tl) => (
                    <option key={tl} value={tl} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pre-fill Geographic Area
                </label>
                <input
                  type="text"
                  value={geographicArea}
                  onChange={(e) => setGeographicArea(e.target.value)}
                  placeholder="Optional (e.g. Gauteng · Sandton)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 leading-relaxed">
            When an applicant opens this link, they immediately see only the Cerebus Add Agent onboarding form without needing to sign in. Once submitted, their dossier, documents, and initial banking confirmation appear immediately in your Admin dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
