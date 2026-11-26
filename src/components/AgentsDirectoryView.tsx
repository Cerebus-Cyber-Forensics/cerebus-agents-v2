import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Link2,
  Plus,
  Search,
  User,
} from 'lucide-react';
import {
  AgentRecord,
  MonthlyConfirmation,
  VerificationStatus,
} from '../types';
import {
  formatTimestamp,
  getAgentFullName,
  maskAccountNumber,
  toMillis,
} from '../utils/cycleUtils';
import { VerificationStatusLabel } from './StatusLabel';
import { ExpandedPhotoTarget } from './PhotoLightboxModal';

interface AgentsDirectoryViewProps {
  agents: AgentRecord[];
  confirmations: MonthlyConfirmation[];
  activeCycle: string;
  onAddAgent: () => void;
  onOpenSignupLink?: () => void;
  onViewAgent: (agent: AgentRecord) => void;
  onExpandPhoto: (photo: ExpandedPhotoTarget) => void;
  onConfirmBanking: (
    agent: AgentRecord,
    cycleMonth: string,
    existingConf?: MonthlyConfirmation | null,
  ) => void;
}

export function AgentsDirectoryView({
  agents,
  confirmations,
  activeCycle,
  onAddAgent,
  onOpenSignupLink,
  onViewAgent,
  onExpandPhoto,
  onConfirmBanking,
}: AgentsDirectoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [leaderFilter, setLeaderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>(
    'all',
  );
  const [revealAccounts, setRevealAccounts] = useState(false);

  const cycleConfMap = useMemo(() => {
    const map = new Map<string, MonthlyConfirmation>();
    for (const c of confirmations) {
      if (c.cycleMonth === activeCycle) {
        map.set(c.agentId, c);
      }
    }
    return map;
  }, [confirmations, activeCycle]);

  const areas = useMemo(
    () =>
      Array.from(new Set(agents.map((a) => a.geographicArea).filter(Boolean))).sort(),
    [agents],
  );
  const leaders = useMemo(
    () =>
      Array.from(
        new Set(agents.map((a) => a.cerebusTeamLeader).filter(Boolean)),
      ).sort(),
    [agents],
  );

  const filteredAgents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return agents.filter((agent) => {
      if (areaFilter !== 'all' && agent.geographicArea !== areaFilter)
        return false;
      if (leaderFilter !== 'all' && agent.cerebusTeamLeader !== leaderFilter)
        return false;

      const conf = cycleConfMap.get(agent.agentId);
      const effectiveStatus: VerificationStatus =
        conf?.verificationStatus || 'pending';
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter)
        return false;

      if (!q) return true;
      const haystack = [
        agent.cerebusAgentCode,
        getAgentFullName(agent),
        agent.emailAddress,
        agent.geographicArea,
        agent.cerebusTeamLeader,
        agent.bankNameAndCode,
        agent.idPassportNumber,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
  }, [agents, searchTerm, areaFilter, leaderFilter, statusFilter, cycleConfMap]);

  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Email Address',
      'Cerebus agent code',
      'Geographic area',
      'Cerebus team leader',
      'First name',
      'Middle names',
      'Surname',
      'Nationality',
      'ID document type',
      'ID/Passport number',
      'Cellphone number',
      'Whatsapp number',
      'Email',
      'T-shirt style',
      'T-shirt size',
      'Your comments',
      'Bank name and code',
      'Account holder name',
      'Account type',
      'Account number',
      `Cycle ${activeCycle} Status`,
      'Late After 2nd',
    ];

    const escapeCsv = (val: string) =>
      `"${(val || '').replace(/"/g, '""')}"`;

    const rows = filteredAgents.map((a) => {
      const conf = cycleConfMap.get(a.agentId);
      return [
        formatTimestamp(a.timestamp),
        a.emailAddress,
        a.cerebusAgentCode,
        a.geographicArea,
        a.cerebusTeamLeader,
        a.firstName,
        a.middleNames,
        a.surname,
        a.nationality,
        a.idDocumentType,
        a.idPassportNumber,
        a.cellphoneNumber,
        a.whatsappNumber,
        a.email,
        a.tShirtStyle,
        a.tShirtSize,
        a.yourComments,
        a.bankNameAndCode,
        a.accountHolderName,
        a.accountType,
        a.accountNumber,
        conf?.verificationStatus || 'pending',
        conf?.isLateAfterCutoff ? 'YES' : 'NO',
      ]
        .map((cell) => escapeCsv(String(cell)))
        .join(',');
    });

    const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cerebus_agents_${activeCycle}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, name, email, bank..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            aria-label="Filter by geographic area"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={leaderFilter}
            onChange={(e) => setLeaderFilter(e.target.value)}
            aria-label="Filter by team leader"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Team Leaders</option>
            {leaders.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | VerificationStatus)
            }
            aria-label="Filter by cycle status"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All {activeCycle} States</option>
            <option value="pending">Pending Confirmation</option>
            <option value="confirmed">Confirmed On-Time</option>
            <option value="late_flagged">Late · Flagged</option>
            <option value="verified">Verified</option>
            <option value="rejected">Correction Needed</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRevealAccounts((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {revealAccounts ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{revealAccounts ? 'Mask Accounts' : 'Reveal Accounts'}</span>
          </button>

          {onOpenSignupLink && (
            <button
              type="button"
              onClick={onOpenSignupLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#0812B8] bg-[#0812B8]/8 border border-[#0812B8]/20 hover:bg-[#0812B8]/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Signup Link</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredAgents.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              No agents match your current filters
            </p>
            <p className="text-xs text-slate-500">
              Add a new Cerebus agent, share the onboarding signup link, or clear your search filters.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onAddAgent}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Agent
              </button>
              {onOpenSignupLink && (
                <button
                  type="button"
                  onClick={onOpenSignupLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Share Signup Link
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    Agent Code
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    Agent Name & Contact
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    Area & Team Leader
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    Banking Details
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    Compliance Docs
                  </th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {activeCycle} Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAgents.map((agent) => {
                  const conf = cycleConfMap.get(agent.agentId);
                  const fullName = getAgentFullName(agent);
                  const hasBankProof = Boolean(
                    conf?.bankDocId ||
                      conf?.actionKind === 'confirmed_existing',
                  );
                  const hasId = Boolean(agent.idDocId);
                  const hasContract = Boolean(agent.contractDocId);

                  return (
                    <tr
                      key={agent.agentId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-slate-900">
                          {agent.cerebusAgentCode}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400">
                          {formatTimestamp(agent.timestamp)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (agent.photoThumbUrl || agent.photoDocId) {
                                onExpandPhoto({
                                  title: fullName,
                                  subtitle: `${agent.cerebusAgentCode} · ${agent.geographicArea}`,
                                  docId: agent.photoDocId,
                                  fallbackThumbUrl: agent.photoThumbUrl,
                                  fileName: agent.photoDocName,
                                });
                              } else {
                                onViewAgent(agent);
                              }
                            }}
                            className="shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-[#0812B8] transition-all"
                            title={
                              agent.photoThumbUrl || agent.photoDocId
                                ? `Click to expand ${fullName}'s profile picture`
                                : `View ${fullName}`
                            }
                          >
                            {agent.photoThumbUrl ? (
                              <img
                                src={agent.photoThumbUrl}
                                alt={fullName}
                                className="w-9 h-9 object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 flex items-center justify-center text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                            )}
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onViewAgent(agent)}
                              className="text-left font-medium text-slate-900 hover:text-blue-700 cursor-pointer block truncate"
                            >
                              {fullName}
                            </button>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">
                              {agent.emailAddress}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 text-xs font-medium">
                          {agent.geographicArea}
                        </div>
                        <div className="text-xs text-slate-500">
                          {agent.cerebusTeamLeader}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-900">
                          {agent.bankNameAndCode}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {agent.accountType} ·{' '}
                          {revealAccounts
                            ? agent.accountNumber
                            : maskAccountNumber(agent.accountNumber)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        <span className={hasId ? 'text-emerald-700' : 'text-red-700'}>
                          ID {hasId ? '✓' : '×'}
                        </span>
                        <span aria-hidden="true" className="mx-1.5 text-slate-300">
                          /
                        </span>
                        <span
                          className={
                            hasContract ? 'text-emerald-700' : 'text-red-700'
                          }
                        >
                          Contract {hasContract ? '✓' : '×'}
                        </span>
                        <span aria-hidden="true" className="mx-1.5 text-slate-300">
                          /
                        </span>
                        <span
                          className={
                            hasBankProof ? 'text-emerald-700' : 'text-amber-700'
                          }
                        >
                          {activeCycle} {hasBankProof ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <VerificationStatusLabel
                          status={conf?.verificationStatus || 'pending'}
                          isLateAfterCutoff={conf?.isLateAfterCutoff}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onViewAgent(agent)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onConfirmBanking(agent, activeCycle, conf)
                            }
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50/70 border border-blue-200 hover:bg-blue-100/70 rounded-md transition-colors cursor-pointer"
                          >
                            Bank
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
