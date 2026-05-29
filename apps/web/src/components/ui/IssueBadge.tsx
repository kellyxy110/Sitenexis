import { type SEOIssueSeverity } from '@sitenexis/shared';
import { clsx } from 'clsx';

interface IssueBadgeProps {
  severity: SEOIssueSeverity;
}

const SEVERITY_CLASSES: Record<SEOIssueSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

export function IssueBadge({ severity }: IssueBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-block rounded px-2 py-0.5 text-xs font-medium capitalize',
        SEVERITY_CLASSES[severity]
      )}
    >
      {severity}
    </span>
  );
}
