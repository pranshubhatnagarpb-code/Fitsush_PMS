import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Measurement {
  id: string;
  client_id: string;
  measurement_date: string;
  bmi: number | null;
  weight: number | null;
  body_fat_percentage: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  thigh: number | null;
  arm: number | null;
  neck: number | null;
  measurement_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeasurementInput {
  client_id: string;
  measurement_date: string;
  bmi?: number | null;
  weight?: number | null;
  body_fat_percentage?: number | null;
  waist?: number | null;
  hip?: number | null;
  chest?: number | null;
  thigh?: number | null;
  arm?: number | null;
  neck?: number | null;
  measurement_notes?: string | null;
}

export const useClientMeasurements = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['measurements', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_measurements')
        .select('*')
        .eq('client_id', clientId)
        .order('measurement_date', { ascending: false });
      if (error) throw error;
      return data as unknown as Measurement[];
    },
    enabled: !!clientId,
  });
};

export const useCreateMeasurement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MeasurementInput) => {
      const { data, error } = await supabase
        .from('client_measurements')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['measurements', vars.client_id] });
      toast.success('Measurement recorded');
    },
    onError: (e: any) => toast.error('Failed to save measurement', { description: e.message }),
  });
};

export const useDeleteMeasurement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from('client_measurements').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['measurements', clientId] });
      toast.success('Measurement deleted');
    },
    onError: (e: any) => toast.error('Failed to delete', { description: e.message }),
  });
};
