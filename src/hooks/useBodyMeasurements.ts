import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BodyMeasurement {
  id: string;
  client_id: string;
  measurement_date: string;
  weight: number | null;
  bmi: number | null;
  body_fat_percent: number | null;
  visceral_fat: number | null;
  muscle_mass: number | null;
  body_age: number | null;
  resting_metabolism: number | null;
  neck: number | null;
  chest: number | null;
  tummy: number | null;
  shoulder: number | null;
  waist: number | null;
  hip: number | null;
  thigh: number | null;
  arm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurementWithClientName extends BodyMeasurement {
  client_name: string;
  // Inches lost (positive) or gained (negative) across INCH_LOSS_FIELDS.
  // null for a client's first entry, or when no field was recorded in both entries.
  inch_loss_total: number | null; // vs. the client's first entry
  inch_loss_change: number | null; // vs. the client's previous entry
}

// Tape measurements summed for inch loss.
export const INCH_LOSS_FIELDS = ['neck', 'chest', 'shoulder', 'tummy', 'waist', 'hip', 'thigh', 'arm'] as const;

// Sum of (earlier - later) over fields recorded in both entries, so a field
// missing from either entry doesn't count as a loss or gain.
export const calcInchLoss = (
  earlier: Partial<BodyMeasurement> | undefined,
  later: Partial<BodyMeasurement> | undefined,
): number | null => {
  if (!earlier || !later) return null;
  let total = 0;
  let compared = 0;
  for (const field of INCH_LOSS_FIELDS) {
    const a = earlier[field];
    const b = later[field];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    total += Number(a) - Number(b);
    compared++;
  }
  return compared ? Math.round(total * 10) / 10 : null;
};

// Adds inch_loss_total / inch_loss_change to every row, per client, in date order.
const withInchLoss = <T extends BodyMeasurement>(rows: T[]): Array<T & Pick<BodyMeasurementWithClientName, 'inch_loss_total' | 'inch_loss_change'>> => {
  const byClient = new Map<string, T[]>();
  rows.forEach((r) => byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), r]));
  const result = new Map<string, { inch_loss_total: number | null; inch_loss_change: number | null }>();
  byClient.forEach((list) => {
    const asc = [...list].sort((a, b) =>
      a.measurement_date.localeCompare(b.measurement_date) || a.created_at.localeCompare(b.created_at));
    asc.forEach((row, i) => result.set(row.id, {
      inch_loss_total: i === 0 ? null : calcInchLoss(asc[0], row),
      inch_loss_change: i === 0 ? null : calcInchLoss(asc[i - 1], row),
    }));
  });
  return rows.map((r) => ({ ...r, ...result.get(r.id)! }));
};

export interface BodyMeasurementInput {
  client_id: string;
  measurement_date: string;
  weight?: number | null;
  bmi?: number | null;
  body_fat_percent?: number | null;
  visceral_fat?: number | null;
  muscle_mass?: number | null;
  body_age?: number | null;
  resting_metabolism?: number | null;
  neck?: number | null;
  chest?: number | null;
  tummy?: number | null;
  shoulder?: number | null;
  waist?: number | null;
  hip?: number | null;
  thigh?: number | null;
  arm?: number | null;
  notes?: string | null;
}

const TABLE_NAME = 'body_measurements';
const bodyMeasurementsTable = () => (supabase as any).from(TABLE_NAME);

const calcBmi = (weightKg: number | null, heightCm: number | null | undefined) => {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

export const hasAnyMeasurementValue = (measurement: Partial<BodyMeasurementInput>) => {
  const numericFields: Array<keyof Omit<BodyMeasurementInput, 'client_id' | 'measurement_date' | 'notes'>> = [
    'weight',
    'bmi',
    'body_fat_percent',
    'visceral_fat',
    'muscle_mass',
    'body_age',
    'resting_metabolism',
    'neck',
    'chest',
    'tummy',
    'shoulder',
    'waist',
    'hip',
    'thigh',
    'arm',
  ];

  return numericFields.some((field) => measurement[field] !== null && measurement[field] !== undefined)
    || Boolean(measurement.notes?.trim());
};

export const useBodyMeasurements = (clientId?: string) => {
  return useQuery({
    queryKey: ['body-measurements', clientId ?? 'all'],
    queryFn: async () => {
      let query = bodyMeasurementsTable()
        .select('*, clients(name, height)')
        .order('measurement_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return withInchLoss((data || []).map((item: any) => ({
        ...item,
        bmi: item.bmi ?? calcBmi(item.weight, item.clients?.height),
        client_name: item.clients?.name || 'Unknown',
      }))) as BodyMeasurementWithClientName[];
    },
    enabled: true,
  });
};

export const useCreateBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (measurement: BodyMeasurementInput) => {
      const { data, error } = await bodyMeasurementsTable()
        .insert(measurement as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BodyMeasurement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to save measurement', { description: error.message });
    },
  });
};

export const useUpdateBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...measurement }: Partial<BodyMeasurementInput> & { id: string; client_id: string }) => {
      const { data, error } = await bodyMeasurementsTable()
        .update(measurement as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BodyMeasurement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to update measurement', { description: error.message });
    },
  });
};

export const useDeleteBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await bodyMeasurementsTable()
        .delete()
        .eq('id', id);

      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', clientId] });
    },
    onError: (error) => {
      toast.error('Failed to delete measurement', { description: error.message });
    },
  });
};