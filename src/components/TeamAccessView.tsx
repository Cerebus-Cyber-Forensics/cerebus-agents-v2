import { useMemo, useState } from 'react';
import {
  Archive,
  Ban,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteUserAccount,
  updateUserAccountStatus,
  updateUserRole,
} from '../services/ledgerService';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  UserAccount,
  UserAccountStatus,
  UserRole,
} from '../types';
import { formatTimestamp, toMillis } from '../utils/cycleUtils';
import { getUserRoleTheme } from '../utils/roleTheme';

interface TeamAccessViewProps {
  users: UserAccount[];
  actor: UserAccount;
  teamLeaderOptions: string[];
  agentCount?: number;
  logCount?: number;
  onResetDatabase?: () => void;
  onToast: (message: string) => void;
}

type UserViewFilter = 'signed_in' | 'active_all' | 'disabled' | 'archived';

function getInitials(name: string, email: string): string {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getEffectiveStatus(user: UserAccount): UserAccountStatus {
  return user.accountStatus || 'active';
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
  const [viewFilter, setViewFilter] = useState<UserViewFilter>('signed_in');
  const [searchTerm, setSearchTerm] = useState('');
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [statusBusyUid, setStatusBusyUid] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    let signedIn = 0;
    let activeAll = 0;
    let disabled = 0;
    let archived = 0;

    for (const u of users) {
      const status = getEffectiveStatus(u);
      if (status === 'archived') {
        archived += 1;
      } else {
        activeAll += 1;
        if (u.lastSignInAt) signedIn += 1;
        if (status === 'disabled') disabled += 1;
      }
    }

    return { signedIn, activeAll, disabled, archived };
  }, [users]);

  const visibleUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = users.filter((u) => {
      const status = getEffectiveStatus(u);
      if (viewFilter === 'signed_in') {
        if (status === 'archived' || !u.lastSignInAt) return false;
      } else if (viewFilter === 'active_all') {
        if (status === 'archived') return false;
      } else if (viewFilter === 'disabled') {
        if (status !== 'disabled') return false;
      } else if (viewFilter === 'archived') {
        if (status !== 'archived') return false;
      }

      if (!q) return true;
      const haystack = [
        u.displayName,
        u.email,
        u.role.replace('_', ' '),
        u.teamLeaderName || '',
        status,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    return [...base].sort((a, b) => {
      const signInDiff = toMillis(b.lastSignInAt) - toMillis(a.lastSignInAt);
      if (signInDiff !== 0) return signInDiff;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  }, [users, viewFilter, searchTerm]);

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

  const handleStatusChange = async (
    target: UserAccount,
    nextStatus: UserAccountStatus,
  ) => {
    setError('');
    setStatusBusyUid(target.uid);
    try {
      await updateUserAccountStatus(target, nextStatus, actor);
      const verb =
        nextStatus === 'disabled'
          ? 'Disabled'
          : nextStatus === 'archived'
            ? 'Archived'
            : 'Restored';
      onToast(`${verb} user account ${target.email}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update user account status.',
      );
    } finally {
      setStatusBusyUid(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setDeletingUid(deleteTarget.uid);
    try {
      await deleteUserAccount(deleteTarget, actor);
      const deletedEmail = deleteTarget.email;
      setDeleteTarget(null);
      onToast(`Deleted user account ${deletedEmail}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete user account.',
      );
    } finally {
      setDeletingUid(null);
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
        <div className="px-5 py-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-700 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Platform Users, Sign-In Activity & Role Assignments
                </h3>
                <p className="text-xs text-slate-500">
                  View signed-in users, manage roles, or disable, archive, and delete user accounts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto self-start lg:self-auto">
              {(
                [
                  ['signed_in', `Signed In (${counts.signedIn})`],
                  ['active_all', `All Users (${counts.activeAll})`],
                  ['disabled', `Disabled (${counts.disabled})`],
                  ['archived', `Archived (${counts.archived})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    viewFilter === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user by name, email, role, or team leader..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {visibleUsers.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-sm font-medium text-slate-900">
              No matching users in this view
            </p>
            <p className="text-xs text-slate-500">
              {viewFilter === 'signed_in'
                ? 'Users appear here once they sign in to the portal at least once.'
                : 'Switch filter tabs or clear your search query to view other accounts.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Assigned Team Leader Scope
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Last Sign-In
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleUsers.map((u) => {
                  const draft = roleDrafts[u.uid] || {
                    role: u.role,
                    teamLeaderName: u.teamLeaderName || '',
                  };
                  const status = getEffectiveStatus(u);
                  const isProtected =
                    u.uid === actor.uid ||
                    u.email.toLowerCase() ===
                      BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                  const isBusy =
                    savingUid === u.uid ||
                    statusBusyUid === u.uid ||
                    deletingUid === u.uid;
                  const roleTheme = getUserRoleTheme(u.role);
                  return (
                    <tr
                      key={u.uid}
                      className={`hover:bg-slate-50/70 ${
                        status !== 'active' ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${roleTheme.avatarBg} ${
                              status !== 'active' ? 'opacity-60' : ''
                            }`}
                          >
                            {getInitials(u.displayName, u.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">
                                {u.displayName}
                              </p>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border ${roleTheme.rowAccent}`}
                              >
                                {roleTheme.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : status === 'disabled' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <Ban className="w-3.5 h-3.5" />
                            Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Archive className="w-3.5 h-3.5" />
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.role}
                          disabled={isBusy}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [u.uid]: {
                                ...draft,
                                role: e.target.value as UserRole,
                              },
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                          disabled={draft.role !== 'team_leader' || isBusy}
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
                          className="w-full max-w-[200px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-mono tabular-nums whitespace-nowrap">
                        {u.lastSignInAt ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-800">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${roleTheme.dotBg}`}
                            />
                            {formatTimestamp(u.lastSignInAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            Never signed in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatTimestamp(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSaveUser(u)}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {savingUid === u.uid ? 'Saving...' : 'Save Role'}
                          </button>

                          {isProtected ? (
                            <span className="px-2 py-1 text-[11px] text-slate-400">
                              Protected
                            </span>
                          ) : (
                            <>
                              {status === 'active' ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleStatusChange(u, 'disabled')
                                  }
                                  title="Disable user access"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Disable</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleStatusChange(u, 'active')
                                  }
                                  title="Restore active user access"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>
                                    {status === 'archived'
                                      ? 'Restore'
                                      : 'Enable'}
                                  </span>
                                </button>
                              )}

                              {status !== 'archived' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleStatusChange(u, 'archived')
                                  }
                                  title="Archive user account"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>Archive</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setDeleteTarget(u)}
                                title="Delete user account"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-700">
                <Trash2 className="w-4 h-4 shrink-0" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Delete User Account
                </h3>
              </div>
              <button
                type="button"
                disabled={deletingUid !== null}
                onClick={() => setDeleteTarget(null)}
                aria-label="Close delete user dialog"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete the platform user record for{' '}
                <span className="font-semibold text-slate-900">
                  {deleteTarget.displayName}
                </span>{' '}
                ({deleteTarget.email})?
              </p>
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                Deleting removes their user profile and role assignment from the ledger. If you want to permanently block portal sign-in while keeping their history, use <span className="font-medium text-slate-700">Disable</span> or <span className="font-medium text-slate-700">Archive</span> instead.
              </p>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingUid !== null}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingUid !== null}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {deletingUid ? 'Deleting...' : 'Delete User'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
