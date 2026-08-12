import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveClients } from '@/hooks/useClients';
import { BodyMeasurement, BodyMeasurementInput } from '@/hooks/useBodyMeasurements';

interface BodyMeasurementFormData {
  client_id: string;
  measurement_date: string;
  weight: string;
  body_fat_percent: string;
  visceral_fat: string;
  muscle_mass: string;
  body_age: string;
  resting_metabolism: string;
  neck: string;
  chest: string;
  tummy: string;
  waist: string;
  hip: string;
  thigh: string;
  arm: string;
  notes: string;
}

const today = new Date().toISOString().split('T')[0];

const emptyFormData: BodyMeasurementFormData = {
  client_id: '',
  measurement_date: today,
  weight: '',
  body_fat_percent: '',
  visceral_fat: '',
  muscle_mass: '',
  body_age: '',
  resting_metabolism: '',
  neck: '',
  chest: '',
  tummy: '',
  waist: '',
  hip: '',
  thigh: '',
  arm: '',
  notes: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement?: BodyMeasurement | null;
  defaultClientId?: string;
  onSubmit: (data: BodyMeasurementInput) => Promise<void>;
  isLoading?: boolean;
}

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calcBmi = (weightKg: number | null, heightCm: number | null | undefined) => {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

const bcaFields: Array<{ key: keyof Omit<BodyMeasurementFormData, 'client_id' | 'measurement_date' | 'notes' | 'neck' | 'chest' | 'tummy' | 'waist' | 'hip' | 'thigh' | 'arm' | 'bmi'>; label: string; placeholder: string }> = [
  { key: 'weight', label: 'Weight (kg)', placeholder: 'e.g., 72.4' },
  { key: 'body_fat_percent', label: 'Body Fat %', placeholder: 'e.g., 28.5' },
  { key: 'visceral_fat', label: 'VF (Visceral Fat)', placeholder: 'e.g., 12' },
  { key: 'muscle_mass', label: 'Muscle Mass', placeholder: 'e.g., 35.2' },
  { key: 'body_age', label: 'Body Age', placeholder: 'e.g., 32' },
  { key: 'resting_metabolism', label: 'RM (Resting Metabolism)', placeholder: 'e.g., 1650' },
];

const measurementFields: Array<{ key: keyof Omit<BodyMeasurementFormData, 'client_id' | 'measurement_date' | 'notes' | 'weight' | 'bmi' | 'body_fat_percent' | 'visceral_fat' | 'muscle_mass' | 'body_age' | 'resting_metabolism'>; label: string; placeholder: string }> = [
  { key: 'neck', label: 'Neck', placeholder: 'e.g., 14' },
  { key: 'chest', label: 'Chest', placeholder: 'e.g., 38' },
  { key: 'tummy', label: 'Tummy', placeholder: 'e.g., 32' },
  { key: 'waist', label: 'Waist', placeholder: 'e.g., 34' },
  { key: 'hip', label: 'Hip', placeholder: 'e.g., 40' },
  { key: 'thigh', label: 'Thigh', placeholder: 'e.g., 22' },
  { key: 'arm', label: 'Arm', placeholder: 'e.g., 12.5' },
];

export const BodyMeasurementFormDialog = ({ open, onOpenChange, measurement, defaultClientId, onSubmit, isLoading }: Props) => {
  const [formData, setFormData] = useState<BodyMeasurementFormData>(emptyFormData);
  const { data: clients = [] } = useActiveClients();
  const isEdit = !!measurement;

  useEffect(() => {
    if (measurement) {
      setFormData({
        client_id: measurement.client_id,
        measurement_date: measurement.measurement_date || today,
        weight: measurement.weight?.toString() || '',
        body_fat_percent: measurement.body_fat_percent?.toString() || '',
        visceral_fat: (measurement as any).visceral_fat?.toString() || '',
        muscle_mass: (measurement as any).muscle_mass?.toString() || '',
        body_age: (measurement as any).body_age?.toString() || '',
        resting_metabolism: (measurement as any).resting_metabolism?.toString() || '',
        neck: measurement.neck?.toString() || '',
        chest: measurement.chest?.toString() || '',
        tummy: (measurement as any).tummy?.toString() || '',
        waist: measurement.waist?.toString() || '',
        hip: measurement.hip?.toString() || '',
        thigh: measurement.thigh?.toString() || '',
        arm: measurement.arm?.toString() || '',
        notes: measurement.notes || '',
      });
      return;
    }

    setFormData({
      ...emptyFormData,
      client_id: defaultClientId || '',
      measurement_date: today,
    });
  }, [measurement, defaultClientId, open]);

  const hasAnyMeasurement = useMemo(() =>
    [...bcaFields, ...measurementFields, { key: 'weight', label: '', placeholder: '' }].some(({ key }) => !!formData[key as keyof BodyMeasurementFormData]?.trim())
    || !!formData.notes.trim(),
  [formData]);

  const selectedClient = clients.find((c) => c.id === formData.client_id);
  const bmi = calcBmi(parseOptionalNumber(formData.weight), selectedClient?.height);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await onSubmit({
      client_id: formData.client_id,
      measurement_date: formData.measurement_date,
      weight: parseOptionalNumber(formData.weight),
      bmi,
      body_fat_percent: parseOptionalNumber(formData.body_fat_percent),
      visceral_fat: parseOptionalNumber(formData.visceral_fat),
      muscle_mass: parseOptionalNumber(formData.muscle_mass),
      body_age: parseOptionalNumber(formData.body_age),
      resting_metabolism: parseOptionalNumber(formData.resting_metabolism),
      neck: parseOptionalNumber(formData.neck),
      chest: parseOptionalNumber(formData.chest),
      tummy: parseOptionalNumber(formData.tummy),
      waist: parseOptionalNumber(formData.waist),
      hip: parseOptionalNumber(formData.hip),
      thigh: parseOptionalNumber(formData.thigh),
      arm: parseOptionalNumber(formData.arm),
      notes: formData.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Measurement' : 'Add Body Measurement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client *</Label>
              <Select value={formData.client_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, client_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="measurement_date">Measurement Date *</Label>
              <Input
                id="measurement_date"
                type="date"
                value={formData.measurement_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, measurement_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">BCA Parameters</h3>
              <p className="text-xs text-muted-foreground mt-1">Body Composition Analysis parameters</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bcaFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData[field.key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label>BMI</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  {bmi ?? (selectedClient ? (selectedClient.height ? '—' : 'No height on file for this client') : 'Select a client')}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Measurements</h3>
              <p className="text-xs text-muted-foreground mt-1">Body measurements in cm</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {measurementFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData[field.key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement_notes">Notes</Label>
            <Textarea
              id="measurement_notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about posture, hydration, device used, or visit observations"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.client_id || !formData.measurement_date || !hasAnyMeasurement}>
              {isLoading ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update Measurement' : 'Save Measurement')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};