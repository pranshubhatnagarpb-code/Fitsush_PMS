import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useUploadDietPlanPdf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, clientId, file }: { planId: string; clientId: string; file: File }) => {
      const filePath = `${clientId}/${planId}/${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('diet-pdfs')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Update diet_plans record
      const { error: updateError } = await supabase
        .from('diet_plans')
        .update({
          pdf_file_path: filePath,
          pdf_file_name: file.name,
          pdf_uploaded_at: new Date().toISOString(),
        })
        .eq('id', planId);
      if (updateError) throw updateError;

      return filePath;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      toast.success('PDF uploaded successfully');
    },
    onError: (e: any) => toast.error('Failed to upload PDF', { description: e.message }),
  });
};

export const useDeleteDietPlanPdf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, filePath }: { planId: string; filePath: string }) => {
      const { error: storageError } = await supabase.storage
        .from('diet-pdfs')
        .remove([filePath]);
      if (storageError) throw storageError;

      const { error: updateError } = await supabase
        .from('diet_plans')
        .update({ pdf_file_path: null, pdf_file_name: null, pdf_uploaded_at: null })
        .eq('id', planId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      toast.success('PDF removed');
    },
    onError: (e: any) => toast.error('Failed to remove PDF', { description: e.message }),
  });
};

export const getSignedPdfUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from('diet-pdfs')
    .createSignedUrl(filePath, 3600); // 1 hour
  if (error) throw error;
  return data.signedUrl;
};
