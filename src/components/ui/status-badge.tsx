import { cn } from '@/lib/utils';
import { ExpenseStatus } from '@/lib/types';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ExpenseStatus;
  className?: string;
}

const statusConfig: Record<ExpenseStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: {
    label: 'Pending',
    className: 'status-pending',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'status-approved',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    className: 'status-rejected',
    icon: XCircle,
  },
  wd_pending: {
    label: 'WD Pending',
    className: 'status-wd',
    icon: AlertCircle,
  },
  wd_approved: {
    label: 'WD Approved',
    className: 'status-approved',
    icon: CheckCircle2,
  },
  wd_rejected: {
    label: 'WD Rejected',
    className: 'status-rejected',
    icon: XCircle,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('status-badge', config.className, className)}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
