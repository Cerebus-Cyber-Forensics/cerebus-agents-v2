import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AgentRecord, MonthlyConfirmation } from '../types';

interface OverviewViewProps {
  agents: AgentRecord[];
  confirmations: MonthlyConfirmation[];
  activeCycle: string;
  onNavigate: (
    view: 'overview' | 'agents' | 'verify' | 'audit' | 'access',
  ) => void;
}

export function OverviewView({
  agents,
  confirmations,
  activeCycle,
  onNavigate,
}: OverviewViewProps) {
  const cycleConfs = confirmations.filter((c) => c.cycleMonth === activeCycle);
  const confByAgent = new Map(cycleConfs.map((c) => [c.agentId, c]));

  const totalAgents = agents.length;
  const verifiedCount = cycleConfs.filter(
    (c) => c.verificationStatus === 'verified',
  ).length;
  const confirmedCount = cycleConfs.filter(
    (c) =>
      c.verificationStatus === 'confirmed' ||
      c.verificationStatus === 'late_flagged',
  ).length;
  const rejectedCount = cycleConfs.filter(
    (c) => c.verificationStatus === 'rejected',
  ).length;
  const pendingOrRejectedCount = agents.filter((a) => {
    const c = confByAgent.get(a.agentId);
    return (
      !c ||
      c.verificationStatus === 'pending' ||
      c.verificationStatus === 'rejected'
    );
  }).length;

  // Group by Team Leader
  const leaderMap = new Map<
    string,
    { total: number; verified: number; needsReview: number; pending: number }
  >();
  for (const agent of agents) {
    const leader = agent.cerebusTeamLeader || 'Unassigned';
    const current = leaderMap.get(leader) || {
      total: 0,
      verified: 0,
      needsReview: 0,
      pending: 0,
    };
    current.total++;
    const conf = confByAgent.get(agent.agentId);
    if (conf?.verificationStatus === 'verified') {
      current.verified++;
    } else if (
      conf?.verificationStatus === 'confirmed' ||
      conf?.verificationStatus === 'late_flagged'
    ) {
      current.needsReview++;
    } else {
      current.pending++;
    }
    leaderMap.set(leader, current);
  }

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Active Agents</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {totalAgents}
          </p>
          <p className="text-xs text-slate-500">
            {pendingOrRejectedCount} pending or needing fix
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Verified Banking</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {verifiedCount}
          </p>
          <p className="text-xs text-slate-500">
            Banking details verified by Admin
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Banking Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-700">
            {confirmedCount}
          </p>
          <p className="text-xs text-slate-500">
            Ready for Team Leader / Admin sign-off
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Corrections Needed</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {rejectedCount}
          </p>
          <p className="text-xs text-slate-500">
            Returned for banking correction
          </p>
        </div>
      </div>

      {/* Team Leader Compliance */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Team Leader Breakdown
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('agents')}
            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
          >
            View Directory
          </button>
        </div>
        {leaderMap.size === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No agents registered yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">
                  Team Leader
                </th>
                <th className="px-3 py-2.5 text-right font-medium">Agents</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  Verified
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  Review
                </th>
                <th className="px-5 py-2.5 text-right font-medium">
                  Pending
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Array.from(leaderMap.entries()).map(([leader, stats]) => (
                <tr key={leader} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {leader}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                    {stats.total}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700">
                    {stats.verified}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-700">
                    {stats.needsReview}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-500">
                    {stats.pending}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
