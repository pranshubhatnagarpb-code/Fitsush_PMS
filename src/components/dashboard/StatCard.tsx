import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  change?: { value: string; isPositive: boolean };
  icon?: ReactNode;
  iconColor?: string;
  tooltip?: string;
  className?: string;
  highlight?: 'success' | 'warning' | 'danger';
  children?: ReactNode;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  change,
  icon,
  iconColor = 'bg-primary/10 text-primary',
  tooltip,
  className,
  highlight,
  children,
}: StatCardProps) => {
  return (
    <Card className={cn(
      "relative overflow-hidden p-5 shadow-card hover:shadow-card-hover transition-all duration-200 border border-border/60",
      className
    )}>
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent rounded-t-[inherit]" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs max-w-[200px]">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {value !== undefined && value !== '' && (
            <p className={cn(
              "text-3xl font-bold tracking-tight",
              highlight === 'success' && "text-success",
              highlight === 'warning' && "text-warning",
              highlight === 'danger' && "text-destructive",
              !highlight && "text-foreground"
            )}>
              {value}
            </p>
          )}

          {children}

          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          )}

          {change && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded-md text-xs font-medium",
              change.isPositive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}>
              <span>{change.isPositive ? '↑' : '↓'} {change.value}</span>
              <span className="text-muted-foreground font-normal">from last entry</span>
            </div>
          )}
        </div>

        {icon && (
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
            iconColor
          )}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
