import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { VerificationStatus } from '../types';

export function VerificationStatusLabel({
  status,
}: {
  status: VerificationStatus;
  isLateAfterCutoff?: boolean;
}) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Verified</span>
      </span>
    );
  }
  if (status === 'late_flagged' || status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Confirmed</span>
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Correction Needed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Pending Confirmation</span>
    </span>
  );
}
