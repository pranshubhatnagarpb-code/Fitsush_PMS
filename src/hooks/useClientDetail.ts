import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Client } from './useClients';

// ---------------------------------------------------------------------------
// Single client by id
// ---------------------------------------------------------------------------
export const useClientById = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId!)
        .single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId,
  });
};

// ---------------------------------------------------------------------------
// Intake submissions for a client (linked via pms_lead_id)
// ---------------------------------------------------------------------------
export interface IntakeSubmission {
  id: string;
  created_at: string;
  branch: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  age: number | null;
  dob: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  payload: Record<string, any>;
  pms_lead_id: string | null;
  pms_status: string;
}

export const useClientIntakeSubmissions = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['intake_submissions', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intake_submissions')
        .select('*')
        .eq('pms_lead_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeSubmission[];
    },
    enabled: !!clientId,
  });
};

// ---------------------------------------------------------------------------
// Progress entries for a client
// ---------------------------------------------------------------------------
export interface ProgressEntry {
  id: string;
  client_id: string;
  entry_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  sleep_quality_rating: number | null;
  digestion_rating: number | null;
  energy_rating: number | null;
  fatigue_rating: number | null;
  skin_rating: number | null;
  hair_rating: number | null;
  acidity_rating: number | null;
  bloating_rating: number | null;
  sleep_hours: number | null;
  water_intake: string | null;
  activity_level: string | null;
  screen_time_hrs: number | null;
  stress_rating: number | null;
  blood_parameters: string[] | null;
  inflammation_concerns: boolean | null;
  meals_per_day: number | null;
  packaged_food_frequency: string | null;
  medications: { name: string; frequency?: string }[] | null;
  periods_status: string | null;
  period_flow: string[] | null;
  period_pain_severity: number | null;
  pms_symptoms: string[] | null;
  libido_rating: number | null;
  testosterone_status: string | null;
  stamina_rating: number | null;
  attention_rating: number | null;
  memory_rating: number | null;
  focus_rating: number | null;
  appetite: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useClientProgressEntries = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['progress_entries', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_progress_entries')
        .select('*')
        .eq('client_id', clientId!)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProgressEntry[];
    },
    enabled: !!clientId,
  });
};

export const useUpdateProgressEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProgressEntry> }) => {
      const { error } = await supabase
        .from('client_progress_entries')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress_entries'] });
      toast.success('Entry updated');
    },
    onError: (e: any) => toast.error('Update failed', { description: e.message }),
  });
};
