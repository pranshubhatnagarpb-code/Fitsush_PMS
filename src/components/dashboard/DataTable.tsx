import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  tooltip?: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  title,
  tooltip,
  columns,
  data,
  emptyMessage = 'No data available',
  className,
}: DataTableProps<T>) {
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
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {data.length} {data.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn("text-[10px] font-bold text-muted-foreground uppercase tracking-wider h-8 px-4", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-10 text-sm"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center mb-1">
                      <span className="text-muted-foreground text-lg">—</span>
                    </div>
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={index}
                  className={cn(
                    "transition-colors border-b border-border/40 hover:bg-primary/[0.03]",
                    index % 2 === 0 ? "bg-white" : "bg-muted/10"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} className={cn("px-4 py-2.5 text-sm", column.className)}>
                      {column.render ? column.render(item) : String(item[column.key as keyof T] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
