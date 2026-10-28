import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useImportClientTracker } from '@/hooks/useClientTracker';
import { parseTab, readWorkbook, type TabResult } from '@/lib/clientTrackerImport';
import { toast } from 'sonner';

type TabState = { name: string; month: string | null; selected: boolean; result: TabResult | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (latestMonth: string) => void;
};

// Excel View → Import from Excel: pick tabs of the tracker workbook (one tab
// per month), check the month each goes to, and import.
export const TrackerImportDialog = ({ open, onOpenChange, onImported }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const importTracker = useImportClientTracker();

  const reset = () => { setFileName(''); setWorkbook(null); setTabs([]); setMode('skip'); };

  const handleFile = async (file: File) => {
    setReading(true);
    try {
      const { workbook: wb, tabs: found } = readWorkbook(await file.arrayBuffer());
      const parsed = await Promise.all(found.map(async (t) => ({
        name: t.name,
        month: t.month,
        selected: !t.skippedByDefault,
        result: t.month ? await parseTab(wb, t.name, t.month) : null,
      })));
      setWorkbook(wb);
      setTabs(parsed);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(`Couldn't read the file: ${e.message ?? e}`);
    } finally {
      setReading(false);
    }
  };

  const setTab = (name: string, patch: Partial<TabState>) =>
    setTabs((prev) => prev.map((t) => (t.name === name ? { ...t, ...patch } : t)));

  const changeMonth = async (name: string, value: string) => {
    if (!workbook) return;
    const month = value ? `${value}-01` : null;
    setTab(name, { month, result: month ? await parseTab(workbook, name, month) : null, selected: !!month });
  };

  const chosen = tabs.filter((t) => t.selected && t.month && t.result);
  const rowCount = chosen.reduce((n, t) => n + t.result!.rows.length, 0);

  const handleImport = async () => {
    const rows = chosen.flatMap((t) => t.result!.rows);
    if (!rows.length) return;
    try {
      const { written, total } = await importTracker.mutateAsync({ rows, mode });
      toast.success(
        mode === 'skip'
          ? `Imported ${written} new row${written === 1 ? '' : 's'}${total > written ? ` · ${total - written} already in Excel View, left as they are` : ''}`
          : `Imported ${total} row${total === 1 ? '' : 's'} (new ones added, existing ones updated)`,
      );
      onImported(chosen.map((t) => t.month!).sort().at(-1)!);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Import failed: ${e.message ?? e}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Upload the tracker workbook. Each tab becomes one month in Excel View; columns are matched by their headers
            (DATE, NAME, PAYMENT, …). Headers Excel View doesn't have go into OTHER.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={reading} className="w-fit">
          {reading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {fileName ? 'Choose a different file' : 'Choose Excel file'}
        </Button>

        {fileName && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> <strong>{fileName}</strong> · {tabs.length} tabs
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setTabs(tabs.map((t) => ({ ...t, selected: !!t.month })))}>Select all</button>
                <button type="button" className="text-primary hover:underline" onClick={() => setTabs(tabs.map((t) => ({ ...t, selected: false })))}>Select none</button>
              </div>
            </div>

            <div className="rounded-md border divide-y max-h-[45vh] overflow-y-auto">
              {tabs.map((t) => {
                const r = t.result;
                const notes = r ? [
                  r.unmappedHeaders.length ? `${r.unmappedHeaders.length} extra column${r.unmappedHeaders.length === 1 ? '' : 's'} → OTHER` : '',
                  r.unparsedDates ? `${r.unparsedDates} date${r.unparsedDates === 1 ? '' : 's'} kept as text` : '',
                  r.totalsSkipped ? `${r.totalsSkipped} total${r.totalsSkipped === 1 ? '' : 's'} skipped` : '',
                ].filter(Boolean) : [];
                return (
                  <div key={t.name} className={`flex items-center gap-3 p-2.5 ${t.selected ? '' : 'opacity-60'}`}>
                    <Checkbox
                      checked={t.selected}
                      disabled={!t.month}
                      onCheckedChange={(c) => setTab(t.name, { selected: !!c })}
                      aria-label={`Import ${t.name}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate" title={r?.unmappedHeaders.join(', ')}>
                        {!t.month ? 'No month in the tab name — pick one to import it' : `${r?.rows.length ?? 0} rows${notes.length ? ` · ${notes.join(' · ')}` : ''}`}
                      </p>
                    </div>
                    <Input
                      type="month"
                      value={t.month?.slice(0, 7) ?? ''}
                      onChange={(e) => changeMonth(t.name, e.target.value)}
                      className="h-8 w-40"
                      aria-label={`Month for ${t.name}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label>Rows already in Excel View</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'skip' | 'update')} className="space-y-1">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="skip" className="mt-0.5" />
                  <span><strong>Keep them</strong>, only add new rows. Safe to re-import a workbook you added rows to.</span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="update" className="mt-0.5" />
                  <span><strong>Replace them</strong> with the sheet's values. Overwrites edits made in Excel View for those rows.</span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                A row counts as "already imported" by its tab name and row number. If rows were inserted or deleted higher up in a tab,
                the rows below shift and import again as new.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={!rowCount || importTracker.isPending}>
            {importTracker.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {rowCount} row{rowCount === 1 ? '' : 's'}
            {chosen.length > 0 && ` from ${chosen.length === 1 ? format(parseISO(chosen[0].month!), 'MMM yyyy') : `${chosen.length} tabs`}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
