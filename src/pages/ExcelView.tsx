import { useMemo, useState } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ClientTrackerEntry,
  ClientTrackerInput,
  TRACKER_COLUMNS,
  TrackerColumnKey,
  useClientTracker,
  useCreateClientTrackerEntry,
  useDeleteClientTrackerEntry,
  useUpdateClientTrackerEntry,
} from '@/hooks/useClientTracker';
import { Home, ChevronRight, ChevronLeft, Plus, Pencil, Trash2, Table2, Search } from 'lucide-react';
import { toast } from 'sonner';

type FormValues = Record<TrackerColumnKey, string>;

const emptyForm = (): FormValues =>
  Object.fromEntries(TRACKER_COLUMNS.map((col) => [col.key, ''])) as FormValues;

const firstOfMonth = (date: Date) => format(date, 'yyyy-MM-01');

const formatDate = (value: string | null) => (value ? format(parseISO(value), 'dd MMM yyyy') : '-');

const ExcelView = () => {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientTrackerEntry | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ClientTrackerEntry | null>(null);

  const { data: entries = [], isLoading, error } = useClientTracker(month);
  const createEntry = useCreateClientTrackerEntry();
  const updateEntry = useUpdateClientTrackerEntry();
  const deleteEntry = useDeleteClientTrackerEntry();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      TRACKER_COLUMNS.some((col) => entry[col.key]?.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (entry: ClientTrackerEntry) => {
    setEditing(entry);
    setForm(Object.fromEntries(TRACKER_COLUMNS.map((col) => [col.key, entry[col.key] ?? ''])) as FormValues);
    setFormOpen(true);
  };

  const handleSave = async () => {
    const values = Object.fromEntries(
      TRACKER_COLUMNS.map((col) => [col.key, form[col.key].trim() || null]),
    ) as Partial<Record<TrackerColumnKey, string | null>>;
    if (Object.values(values).every((v) => v === null)) {
      toast.error('Fill in at least one field.');
      return;
    }
    const input: ClientTrackerInput = { month, ...values };
    try {
      if (editing) {
        await updateEntry.mutateAsync({ id: editing.id, ...input, month: editing.month });
        toast.success('Entry updated');
      } else {
        await createEntry.mutateAsync(input);
        toast.success('Entry added');
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save entry');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntry.mutateAsync(deleteTarget.id);
      toast.success('Entry deleted');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete entry');
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    ...TRACKER_COLUMNS.map((col) => ({
      key: col.key,
      header: col.header,
      className: 'whitespace-nowrap',
      render: (entry: ClientTrackerEntry) => {
        if (col.type === 'date') return formatDate(entry[col.key]);
        const value = entry[col.key] || '-';
        // OTHER can hold several labelled items from old tabs — truncate, full text on hover.
        return col.key === 'other'
          ? <span className="block max-w-[320px] truncate" title={value}>{value}</span>
          : value;
      },
    })),
    {
      key: 'actions',
      header: '',
      className: 'whitespace-nowrap text-right',
      render: (entry: ClientTrackerEntry) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(entry)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const monthDate = parseISO(month);

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Excel View</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Table2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Excel View</h1>
            <p className="text-sm text-muted-foreground">Monthly client tracker — payments, sessions, leads, drop-outs and more.</p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Entry
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonth(firstOfMonth(addMonths(monthDate, -1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
            className="h-9 w-44"
          />
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonth(firstOfMonth(addMonths(monthDate, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this month..." className="h-9 w-64 pl-8" />
        </div>
      </div>

      <DataTable
        title={format(monthDate, 'MMMM yyyy').toUpperCase()}
        columns={columns as any}
        data={filtered}
        emptyMessage={
          isLoading
            ? 'Loading...'
            : error
              ? `Couldn't load entries: ${(error as Error).message}`
              : 'No entries for this month'
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Entry' : 'Add Entry'} — {format(editing ? parseISO(editing.month) : monthDate, 'MMMM yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRACKER_COLUMNS.map((col) => (
              <div key={col.key} className="space-y-1.5">
                <Label htmlFor={`tracker-${col.key}`} className="text-xs uppercase tracking-wide">{col.header}</Label>
                <Input
                  id={`tracker-${col.key}`}
                  type={col.type}
                  value={form[col.key]}
                  onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createEntry.isPending || updateEntry.isPending}>
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name ? `"${deleteTarget.name}" will be removed` : 'This entry will be removed'} from {format(monthDate, 'MMMM yyyy')}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default ExcelView;
