import { AuditChangeItem } from '../types';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function getCurrentCycleMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function getCycleOptions(now: Date = new Date()): string[] {
  const current = getCurrentCycleMonth(now);
  const year = now.getFullYear();
  const monthIdx = now.getMonth();

  const generated = new Set<string>(['202609', '202610']);
  for (let offset = -2; offset <= 1; offset++) {
    const d = new Date(year, monthIdx + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    generated.add(`${y}${m}`);
  }
  generated.add(current);
  return Array.from(generated).sort((a, b) => b.localeCompare(a));
}

export function formatCycleLabel(cycleMonth: string): string {
  if (!/^\d{6}$/.test(cycleMonth)) return cycleMonth;
  const year = cycleMonth.slice(0, 4);
  const monthNum = parseInt(cycleMonth.slice(4, 6), 10);
  const monthName = MONTH_NAMES[monthNum - 1] ?? cycleMonth.slice(4, 6);
  return `${cycleMonth} · ${monthName} ${year}`;
}

export function getCutoffDateString(cycleMonth: string): string {
  if (!/^\d{6}$/.test(cycleMonth)) return '2026-11-02';
  return `${cycleMonth.slice(0, 4)}-${cycleMonth.slice(4, 6)}-02`;
}

export function getPayoutDateString(cycleMonth: string): string {
  if (!/^\d{6}$/.test(cycleMonth)) return '2026-11-07';
  return `${cycleMonth.slice(0, 4)}-${cycleMonth.slice(4, 6)}-07`;
}

export interface CutoffStatus {
  isAfterCutoff: boolean;
  daysDelta: number;
  cutoffDateStr: string;
  payoutDateStr: string;
  statusHeadline: string;
  statusDetail: string;
}

export function getCutoffStatus(
  cycleMonth: string,
  now: Date = new Date(),
): CutoffStatus {
  const cutoffDateStr = getCutoffDateString(cycleMonth);
  const payoutDateStr = getPayoutDateString(cycleMonth);

  const year = parseInt(cycleMonth.slice(0, 4), 10);
  const monthIdx = parseInt(cycleMonth.slice(4, 6), 10) - 1;
  const cutoffEnd = new Date(year, monthIdx, 2, 23, 59, 59, 999);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = cutoffEnd.getTime() - now.getTime();
  const isAfterCutoff = diffMs < 0;
  const daysDelta = Math.ceil(Math.abs(diffMs) / msPerDay);

  if (isAfterCutoff) {
    return {
      isAfterCutoff: true,
      daysDelta,
      cutoffDateStr,
      payoutDateStr,
      statusHeadline: `Late Window · ${daysDelta}d past 2nd cutoff`,
      statusDetail: `Cutoff ${cutoffDateStr} has passed ahead of ${payoutDateStr} payout. Submissions remain open and are flagged for Admin review.`,
    };
  }

  return {
    isAfterCutoff: false,
    daysDelta,
    cutoffDateStr,
    payoutDateStr,
    statusHeadline: `On-Time Window · ${daysDelta}d until 2nd cutoff`,
    statusDetail: `Banking updates and statements for ${formatCycleLabel(cycleMonth)} are due by ${cutoffDateStr} (5 days before ${payoutDateStr}).`,
  };
}

export function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.trim();
  if (cleaned.length <= 4) return cleaned;
  return `•••• ${cleaned.slice(-4)}`;
}

export function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '—';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  return 0;
}

export function buildFieldDiffs<T extends Record<string, unknown>>(
  previousObj: T,
  nextObj: Partial<T>,
  labels: Record<string, string>,
): AuditChangeItem[] {
  const diffs: AuditChangeItem[] = [];
  for (const [key, label] of Object.entries(labels)) {
    if (!(key in nextObj)) continue;
    const prevVal = String(previousObj[key] ?? '').trim();
    const nextVal = String(nextObj[key] ?? '').trim();
    if (prevVal !== nextVal) {
      diffs.push({
        field: label,
        previousValue: prevVal || '(empty)',
        newValue: nextVal || '(empty)',
      });
    }
  }
  return diffs.slice(0, 30);
}

export function getAgentFullName(agent: {
  firstName: string;
  middleNames?: string;
  surname: string;
}): string {
  return [agent.firstName, agent.middleNames, agent.surname]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ');
}
