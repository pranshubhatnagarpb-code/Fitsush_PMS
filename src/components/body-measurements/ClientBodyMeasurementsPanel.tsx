import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  BodyMeasurementInput,
  BodyMeasurementWithClientName,
  useBodyMeasurements,
  useCreateBodyMeasurement,
  useDeleteBodyMeasurement,
} from '@/hooks/useBodyMeasurements';
import { BodyMeasurementFormDialog } from '@/components/body-measurements/BodyMeasurementFormDialog';

interface Props {
  clientId: string;
  clientName: string;
}

export const ClientBodyMeasurementsPanel = ({ clientId, clientName }: Props) => {
  const { data: measurements = [], isLoading } = useBodyMeasurements(clientId);
  const createMeasurement = useCreateBodyMeasurement();
  const deleteMeasurement = useDeleteBodyMeasurement();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async (data: BodyMeasurementInput) => {
    await createMeasurement.mutateAsync(data);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Body Measurements — {clientName}</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
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
              {measurements.map((m: BodyMeasurementWithClientName) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {format(new Date(m.measurement_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{m.weight ?? '-'}</TableCell>
                  <TableCell>{m.bmi ?? '-'}</TableCell>
                  <TableCell>{m.body_fat_percent ?? '-'}</TableCell>
                  <TableCell>{m.waist ?? '-'}</TableCell>
                  <TableCell>{m.hip ?? '-'}</TableCell>
                  <TableCell>{m.chest ?? '-'}</TableCell>
                  <TableCell>{m.arm ?? '-'}</TableCell>
                  <TableCell>{m.thigh ?? '-'}</TableCell>
                  <TableCell>{m.neck ?? '-'}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{m.notes ?? '-'}</TableCell>
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

      <BodyMeasurementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultClientId={clientId}
        onSubmit={handleCreate}
        isLoading={createMeasurement.isPending}
      />
    </div>
  );
};
