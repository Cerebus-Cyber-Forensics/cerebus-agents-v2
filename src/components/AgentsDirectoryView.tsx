import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Link2,
  Plus,
  Search,
  User,
  X,
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
import { downloadCsv } from '../utils/csvUtils';
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
    const tokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return agents
      .filter((agent) => {
        if (areaFilter !== 'all' && agent.geographicArea !== areaFilter)
          return false;
        if (leaderFilter !== 'all' && agent.cerebusTeamLeader !== leaderFilter)
          return false;

        const conf = cycleConfMap.get(agent.agentId);
        const effectiveStatus: VerificationStatus =
          conf?.verificationStatus || 'pending';
        if (statusFilter !== 'all' && effectiveStatus !== statusFilter)
          return false;

        if (tokens.length === 0) return true;
        const haystack = [
          agent.cerebusAgentCode,
          getAgentFullName(agent),
          `${agent.firstName || ''} ${agent.surname || ''}`.trim(),
          agent.emailAddress,
          agent.email,
          agent.cerebusTeamLeader,
          agent.geographicArea,
          agent.bankNameAndCode,
          agent.idPassportNumber,
          agent.cellphoneNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
  }, [agents, searchTerm, areaFilter, leaderFilter, statusFilter, cycleConfMap]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    areaFilter !== 'all' ||
    leaderFilter !== 'all' ||
    statusFilter !== 'all';

  const handleClearFilters = () => {
    setSearchTerm('');
    setAreaFilter('all');
    setLeaderFilter('all');
    setStatusFilter('all');
  };

  const handleExportCsv = () => {
    if (filteredAgents.length === 0) return;

    const headers = [
      'Payment Cycle',
      'Cerebus agent code',
      'Full Name',
      'First name',
      'Middle names',
      'Surname',
      'Email Address',
      'Contact Email',
      'Cellphone number',
      'Whatsapp number',
      'Geographic area',
      'Cerebus team leader',
      'Nationality',
      'ID document type',
      'ID/Passport number',
      'Bank name and code',
      'Account holder name',
      'Account type',
      'Account number',
      `Cycle ${activeCycle} Status`,
      'Confirmation Action',
      'Late After 2nd',
      'Confirmed / Updated At',
      'Verified By',
      'Verified At',
      'Onboarded At',
      'Your comments',
    ];

    const rows = filteredAgents.map((a) => {
      const conf = cycleConfMap.get(a.agentId);
      return [
        activeCycle,
        a.cerebusAgentCode,
        getAgentFullName(a),
        a.firstName,
        a.middleNames,
        a.surname,
        a.emailAddress,
        a.email,
        a.cellphoneNumber,
        a.whatsappNumber,
        a.geographicArea,
        a.cerebusTeamLeader,
        a.nationality,
        a.idDocumentType,
        a.idPassportNumber,
        conf?.bankNameAndCode || a.bankNameAndCode,
        conf?.accountHolderName || a.accountHolderName,
        conf?.accountType || a.accountType,
        conf?.accountNumber || a.accountNumber,
        conf?.verificationStatus || 'pending',
        conf?.actionKind || '',
        conf?.isLateAfterCutoff ? 'YES' : 'NO',
        conf ? formatTimestamp(conf.updatedAt || conf.submittedAt) : '',
        conf?.verifiedByName || '',
        conf?.verifiedAt || '',
        formatTimestamp(a.timestamp),
        a.yourComments,
      ];
    });

    downloadCsv(`cerebus_agents_payroll_${activeCycle}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              role="searchbox"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or team leader..."
              aria-label="Search agents by name, email, or assigned team leader"
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search query"
                title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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
            disabled={filteredAgents.length === 0}
            onClick={handleExportCsv}
            title={`Export ${filteredAgents.length} filtered agent record(s) for payroll`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
          <span>
            Showing{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {filteredAgents.length}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {agents.length}
            </span>{' '}
            agents
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0812B8] hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        </div>
      )}

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
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Filters
                </button>
              )}
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
