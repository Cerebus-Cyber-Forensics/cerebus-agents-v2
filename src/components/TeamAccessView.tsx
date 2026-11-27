import { useState } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { updateUserRole } from '../services/ledgerService';
import { UserAccount, UserRole } from '../types';
import { formatTimestamp } from '../utils/cycleUtils';

interface TeamAccessViewProps {
  users: UserAccount[];
  actor: UserAccount;
  teamLeaderOptions: string[];
  agentCount?: number;
  logCount?: number;
  onResetDatabase?: () => void;
  onToast: (message: string) => void;
}

export function TeamAccessView({
  users,
  actor,
  teamLeaderOptions,
  agentCount = 0,
  logCount = 0,
  onResetDatabase,
  onToast,
}: TeamAccessViewProps) {
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: UserRole; teamLeaderName: string }>
  >({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSaveUser = async (target: UserAccount) => {
    setError('');
    const draft = roleDrafts[target.uid] || {
      role: target.role,
      teamLeaderName: target.teamLeaderName || '',
    };
    if (draft.role === 'team_leader' && !draft.teamLeaderName.trim()) {
      setError(
        `Please enter the Cerebus Team Leader name for ${target.email}.`,
      );
      return;
    }
    setSavingUid(target.uid);
    try {
      await updateUserRole(target, draft.role, draft.teamLeaderName, actor);
      onToast(`Updated role for ${target.email} to ${draft.role}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update user access.',
      );
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Registered Platform Users & Role Assignments
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {users.length} users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">
                  Assigned Team Leader Scope
                </th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => {
                const draft = roleDrafts[u.uid] || {
                  role: u.role,
                  teamLeaderName: u.teamLeaderName || '',
                };
                const isSaving = savingUid === u.uid;
                return (
                  <tr key={u.uid}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {u.displayName}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={draft.role}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [u.uid]: {
                              ...draft,
                              role: e.target.value as UserRole,
                            },
                          }))
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="admin">Admin</option>
                        <option value="team_leader">Team Leader</option>
                        <option value="agent">Agent</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        list="team-leaders-list"
                        disabled={draft.role !== 'team_leader'}
                        value={draft.teamLeaderName}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [u.uid]: {
                              ...draft,
                              teamLeaderName: e.target.value,
                            },
                          }))
                        }
                        placeholder={
                          draft.role === 'team_leader'
                            ? 'Exact Team Leader name'
                            : 'N/A'
                        }
                        className="w-full max-w-[220px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimestamp(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveUser(u)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isSaving ? 'Saving...' : 'Save Role'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <datalist id="team-leaders-list">
          {teamLeaderOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {onResetDatabase && (
        <div className="bg-white border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Reset Demo Database
            </h3>
            <p className="text-xs text-slate-600">
              Permanently remove all {agentCount} agent record{agentCount === 1 ? '' : 's'}, banking confirmations, uploaded documents, and {logCount} audit log{logCount === 1 ? '' : 's'} to start from a clean database. Admin and Team Leader accounts are kept.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDatabase}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Agents & Logs</span>
          </button>
        </div>
      )}
    </div>
  );
}
