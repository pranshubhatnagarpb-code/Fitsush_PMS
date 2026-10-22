import { cn } from '@/lib/utils';

// Formats an inch-loss figure: positive = inches lost, negative = inches gained.
export const formatInchLoss = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  if (value === 0) return 'No change';
  return value > 0 ? `${value} in lost` : `${Math.abs(value)} in gained`;
};

// Table cell: total since the client's first entry, with the change since the previous entry below it.
export const InchLossCell = ({ total, change }: { total: number | null; change: number | null }) => {
  if (total === null && change === null) {
    return <span className="text-muted-foreground text-xs">Baseline</span>;
  }
  return (
    <div className="whitespace-nowrap">
      <span className={cn('font-semibold', total !== null && total > 0 && 'text-success', total !== null && total < 0 && 'text-destructive')}>
        {formatInchLoss(total)}
      </span>
      {change !== null && change !== total && (
        <div className="text-xs text-muted-foreground">
          {change > 0 ? `−${change}` : change < 0 ? `+${Math.abs(change)}` : '±0'} in since last
        </div>
      )}
    </div>
  );
};
