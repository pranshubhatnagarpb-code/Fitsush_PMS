import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientNote {
  id: string;
  client_id: string;
  note_date: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNoteInput {
  client_id: string;
  note_date: string;
  note_text: string;
  created_by?: string | null;
}

export const useClientNotes = (clientId: string) => {
  return useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ClientNote[];
    },
    enabled: !!clientId,
  });
};

export const useCreateClientNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: ClientNoteInput) => {
      const { data, error } = await supabase
        .from('client_notes')
        .insert(note)
        .select()
        .single();

      if (error) throw error;
      return data as ClientNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to save note', { description: error.message });
    },
  });
};

export const useUpdateClientNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_id, ...note }: Partial<ClientNoteInput> & { id: string; client_id: string }) => {
      const { data, error } = await supabase
        .from('client_notes')
        .update(note)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ClientNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to update note', { description: error.message });
    },
  });
};

export const useDeleteClientNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to delete note', { description: error.message });
    },
  });
};
