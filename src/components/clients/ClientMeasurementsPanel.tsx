import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import {
  useClientMeasurements,
  useCreateMeasurement,
  useDeleteMeasurement,
  MeasurementInput,
} from '@/hooks/useMeasurements';
import { format } from 'date-fns';

interface Props {
  clientId: string;
  clientName: string;
  heightCm?: number | null;
}

const emptyForm = (): Omit<MeasurementInput, 'client_id' | 'bmi'> => ({
  measurement_date: new Date().toISOString().split('T')[0],
  weight: null,
  body_fat_percentage: null,
  waist: null,
  hip: null,
  chest: null,
  arm: null,
  thigh: null,
  neck: null,
  measurement_notes: null,
});

const calcBmi = (weightKg: number | null, heightCm: number | null | undefined) => {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

export const ClientMeasurementsPanel = ({ clientId, clientName, heightCm }: Props) => {
  const { data: measurements = [], isLoading } = useClientMeasurements(clientId);
  const createMeasurement = useCreateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const bmi = calcBmi(form.weight ?? null, heightCm);

  const numField = (key: keyof typeof form, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={(form[key] as any) ?? ''}
        onChange={(e) =>
          setForm({ ...form, [key]: e.target.value ? parseFloat(e.target.value) : null })
        }
        placeholder="-"
      />
    </div>
  );

  const handleSave = async () => {
    await createMeasurement.mutateAsync({ ...form, bmi, client_id: clientId });
    setForm(emptyForm());
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Body Measurements — {clientName}</h3>
        <Button
          size="sm"
          onClick={() => {
            setForm(emptyForm());
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Measurement
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : measurements.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No measurements recorded yet.
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>BMI</TableHead>
                <TableHead>Body Fat %</TableHead>
                <TableHead>Waist</TableHead>
                <TableHead>Hip</TableHead>
                <TableHead>Chest</TableHead>
                <TableHead>Arm</TableHead>
                <TableHead>Thigh</TableHead>
                <TableHead>Neck</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {format(new Date(m.measurement_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{m.weight ?? '-'}</TableCell>
                  <TableCell>{m.bmi ?? calcBmi(m.weight, heightCm) ?? '-'}</TableCell>
                  <TableCell>{m.body_fat_percentage ?? '-'}</TableCell>
                  <TableCell>{m.waist ?? '-'}</TableCell>
                  <TableCell>{m.hip ?? '-'}</TableCell>
                  <TableCell>{m.chest ?? '-'}</TableCell>
                  <TableCell>{m.arm ?? '-'}</TableCell>
                  <TableCell>{m.thigh ?? '-'}</TableCell>
                  <TableCell>{m.neck ?? '-'}</TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {m.measurement_notes ?? m.notes ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Delete this measurement?'))
                          deleteMeasurement.mutate({ id: m.id, clientId });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Measurement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.measurement_date}
                onChange={(e) => setForm({ ...form, measurement_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {numField('weight', 'Weight (kg)')}
              <div className="space-y-1">
                <Label className="text-xs">BMI</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  {bmi ?? (heightCm ? '—' : 'No height on file')}
                </div>
              </div>
              {numField('body_fat_percentage', 'Body Fat %')}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {numField('waist', 'Waist (cm)')}
              {numField('hip', 'Hip (cm)')}
              {numField('chest', 'Chest (cm)')}
              {numField('arm', 'Arm (cm)')}
              {numField('thigh', 'Thigh (cm)')}
              {numField('neck', 'Neck (cm)')}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.measurement_notes ?? ''}
                onChange={(e) =>
                  setForm({ ...form, measurement_notes: e.target.value || null })
                }
                placeholder="Any observations..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMeasurement.isPending}>
              {createMeasurement.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
