import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface InfoCardProps {
  title: string;
  tooltip?: string;
  actionLabel?: string;
  onAction?: () => void;
  customAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const InfoCard = ({
  title,
  tooltip,
  actionLabel,
  onAction,
  customAction,
  children,
  className,
}: InfoCardProps) => {
  return (
    <Card className={cn(
      "shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden border border-border/60",
      className
    )}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70 bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
        {customAction}
        {!customAction && actionLabel && onAction && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/5 px-2"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
};
