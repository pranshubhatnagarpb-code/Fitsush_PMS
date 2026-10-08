import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Bill,
  useClientBills,
  useCreateBill,
  useUpdateBill,
  useDeleteBill,
} from '@/hooks/useBills';
import { BillFormDialog } from '@/components/bills/BillFormDialog';
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

interface Props {
  clientId: string;
  clientName: string;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  paid: 'default',
  pending: 'secondary',
  overdue: 'destructive',
};

export const ClientBillingPanel = ({ clientId, clientName }: Props) => {
  const { data: bills = [], isLoading } = useClientBills(clientId);
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);

  const openCreate = () => {
    setEditingBill(null);
    setDialogOpen(true);
  };

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingBill) {
      await updateBill.mutateAsync({ id: editingBill.id, ...data });
    } else {
      await createBill.mutateAsync(data);
    }
    setDialogOpen(false);
    setEditingBill(null);
  };

  const totalBilled = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalPaid = bills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
  const totalDue = totalBilled - totalPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Billing — {clientName}</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Bill
        </Button>
      </div>

      {bills.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Billed</p>
            <p className="text-lg font-semibold text-foreground">₹{totalBilled.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-semibold text-foreground">₹{totalPaid.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className={`text-lg font-semibold ${totalDue > 0 ? 'text-destructive' : 'text-foreground'}`}>
              ₹{totalDue.toLocaleString('en-IN')}
            </p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : bills.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No bills recorded yet.
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {bill.due_date ? format(new Date(bill.due_date), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell>{bill.service_name}</TableCell>
                  <TableCell>₹{(bill.amount ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{(bill.paid_amount ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[bill.status] ?? 'secondary'} className="capitalize">
                      {bill.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{bill.notes ?? '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(bill)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(bill)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BillFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingBill(null);
        }}
        bill={editingBill}
        defaultClientId={clientId}
        onSubmit={handleSubmit}
        isLoading={createBill.isPending || updateBill.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the "{deleteTarget?.service_name}" bill entry. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await deleteBill.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
