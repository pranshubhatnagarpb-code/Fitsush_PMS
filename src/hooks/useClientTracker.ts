import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Columns of the clinic's monthly tracker workbook, in workbook order.
// `header` is the label exactly as it appears in the Excel sheet.
export const TRACKER_COLUMNS = [
  { key: 'entry_date', header: 'DATE', type: 'date' },
  { key: 'name', header: 'NAME', type: 'text' },
  { key: 'payment', header: 'PAYMENT', type: 'text' },
  { key: 'starting_date', header: 'STARTING DATE', type: 'date' },
  { key: 'ending_date', header: 'ENDING DATE', type: 'date' },
  { key: 'next_session', header: 'NEXT SESSION', type: 'text' },
  { key: 'pending_payments', header: 'PENDING PAYMENTS', type: 'text' },
  { key: 'pending_appointments', header: 'PENDING APPOINTMENTS', type: 'text' },
  { key: 'leads', header: 'LEADS', type: 'text' },
  { key: 'reference', header: 'REFERENCES', type: 'text' },
  { key: 'missed_recalls', header: 'MISSED RECALLS', type: 'text' },
  { key: 'collab', header: 'COLLAB', type: 'text' },
  { key: 'diet_plan', header: 'DIET PLAN', type: 'text' },
  { key: 'non_converted', header: 'NON-CONVERTED', type: 'text' },
  { key: 'fixed_appointments', header: 'FIXED APPOINTMENTS', type: 'text' },
  { key: 'drop_outs', header: 'DROP OUTS', type: 'text' },
  { key: 'before_after', header: 'BEFORE AFTER', type: 'text' },
  { key: 'review', header: 'REVIEW', type: 'text' },
  // Not a workbook header — labelled leftovers from older tabs' since-dropped
  // headers (EXISTING CLIENTS, DAILY CALLS, …), filled by the history import.
  { key: 'other', header: 'OTHER', type: 'text' },
] as const;

export type TrackerColumnKey = (typeof TRACKER_COLUMNS)[number]['key'];

export type ClientTrackerInput = { month: string } & Partial<Record<TrackerColumnKey, string | null>>;

export interface ClientTrackerEntry extends Record<TrackerColumnKey, string | null> {
  id: string;
  month: string;
  created_at: string;
  updated_at: string;
}

const TABLE_NAME = 'client_tracker';
const clientTrackerTable = () => (supabase as any).from(TABLE_NAME);

export const useClientTracker = (month: string) =>
  useQuery({
    queryKey: ['client-tracker', month],
    queryFn: async () => {
      const { data, error } = await clientTrackerTable()
        .select('*')
        .eq('month', month)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientTrackerEntry[];
    },
  });

export const useCreateClientTrackerEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientTrackerInput) => {
      const { error } = await clientTrackerTable().insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-tracker'] }),
  });
};

export const useUpdateClientTrackerEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ClientTrackerInput & { id: string }) => {
      const { error } = await clientTrackerTable()
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-tracker'] }),
  });
};

export const useDeleteClientTrackerEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await clientTrackerTable().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-tracker'] }),
  });
};
