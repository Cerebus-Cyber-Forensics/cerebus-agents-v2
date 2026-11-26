import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Trash2 } from 'lucide-react';
import { AuditActionType, AuditLogEntry } from '../types';
import { formatTimestamp, toMillis } from '../utils/cycleUtils';

interface AuditTrailViewProps {
  auditLogs: AuditLogEntry[];
  isAdmin?: boolean;
  onResetDatabase?: () => void;
}

const ACTION_LABELS: Record<AuditActionType, string> = {
  agent_created: 'Agent Onboarded',
  personal_info_updated: 'Personal Info Updated',
  banking_updated: 'Banking Changed',
  monthly_confirmed: 'Monthly Confirmed',
  document_uploaded: 'Document Uploaded',
  payment_verified: 'Payment Verified',
  payment_rejected: 'Correction Requested',
  role_updated: 'Access Role Updated',
};

export function AuditTrailView({
  auditLogs,
  isAdmin,
  onResetDatabase,
}: AuditTrailViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | AuditActionType>('all');
  const [lateOnly, setLateOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...auditLogs]
      .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))
      .filter((log) => {
        if (actionFilter !== 'all' && log.actionType !== actionFilter)
          return false;
        if (lateOnly && !log.isLateAfterCutoff) return false;
        if (!q) return true;
        const haystack = [
          log.actorName,
          log.actorEmail,
          log.agentCode,
          log.agentName,
          log.summary,
          log.cycleMonth,
          ...log.changes.map((c) => `${c.field} ${c.previousValue} ${c.newValue}`),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [auditLogs, searchTerm, actionFilter, lateOnly]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actor, agent code, field..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) =>
              setActionFilter(e.target.value as 'all' | AuditActionType)
            }
            aria-label="Filter by action type"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Event Types</option>
            {Object.entries(ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg bg-white cursor-pointer">
            <input
              type="checkbox"
              checked={lateOnly}
              onChange={(e) => setLateOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>Post-Cutoff Late Only</span>
          </label>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
            {filteredLogs.length} immutable entries
          </span>
          {isAdmin && onResetDatabase && (
            <button
              type="button"
              onClick={onResetDatabase}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Agents & Logs</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No paper trail entries match your filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredLogs.map((log) => {
              const isExpanded = Boolean(expandedIds[log.logId]);
              return (
                <div key={log.logId} className="p-4 hover:bg-slate-50/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {log.changes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(log.logId)}
                          aria-label="Toggle field changes"
                          className="mt-0.5 p-1 text-slate-400 hover:text-slate-800 rounded cursor-pointer shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span className="font-semibold text-slate-900">
                            {ACTION_LABELS[log.actionType] || log.actionType}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            {log.agentCode}
                          </span>
                          <span>({log.agentName})</span>
                          {log.cycleMonth && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Cycle {log.cycleMonth}
                              </span>
                            </>
                          )}
                          {log.isLateAfterCutoff && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 font-medium">
                                Late after 2nd cutoff
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-slate-800">{log.summary}</p>
                        <p className="text-xs text-slate-500">
                          Actor: {log.actorName} ({log.actorEmail}) · Role:{' '}
                          {log.actorRole.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pl-7 md:pl-0">
                      {log.changes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(log.logId)}
                          className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          {isExpanded
                            ? 'Hide Diff'
                            : `View ${log.changes.length} Change${log.changes.length === 1 ? '' : 's'}`}
                        </button>
                      )}
                      <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  {isExpanded && log.changes.length > 0 && (
                    <div className="mt-3 ml-7 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium w-1/3">
                              Field
                            </th>
                            <th className="px-3 py-1.5 text-left font-medium w-1/3">
                              Previous Value
                            </th>
                            <th className="px-3 py-1.5 text-left font-medium w-1/3">
                              New Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {log.changes.map((chg, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {chg.field}
                              </td>
                              <td className="px-3 py-2 text-slate-500 break-all">
                                {chg.previousValue}
                              </td>
                              <td className="px-3 py-2 text-slate-900 font-medium break-all">
                                {chg.newValue}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
