import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateDietPlanPdfBlob } from '@/lib/dietPlanPdf';

export interface DietPlanFile {
  id: string;
  client_id: string;
  diet_plan_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  is_published?: boolean;
  published_at?: string | null;
  published_by?: string | null;
}

const BUCKET = 'diet-plan-pdfs';

export const useClientDietPlanFiles = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client_diet_plan_files', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_diet_plan_files')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DietPlanFile[];
    },
    enabled: !!clientId,
  });
};

export const usePlanDietPlanFiles = (planId: string | undefined) => {
  return useQuery({
    queryKey: ['client_diet_plan_files', 'plan', planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from('client_diet_plan_files')
        .select('*')
        .eq('diet_plan_id', planId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DietPlanFile[];
    },
    enabled: !!planId,
  });
};

export const useUploadDietPlanFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      dietPlanId,
      file,
    }: {
      clientId: string;
      dietPlanId?: string | null;
      file: File;
    }) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${clientId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || 'application/pdf' });
      if (upErr) throw upErr;

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('client_diet_plan_files')
        .insert({
          client_id: clientId,
          diet_plan_id: dietPlanId ?? null,
          file_name: file.name,
          file_path: path,
          mime_type: file.type || 'application/pdf',
          file_size: file.size,
          uploaded_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files', row.client_id] });
      if (row.diet_plan_id) qc.invalidateQueries({ queryKey: ['client_diet_plan_files', 'plan', row.diet_plan_id] });
      toast.success('PDF uploaded');
    },
    onError: (e: any) => toast.error('Upload failed', { description: e.message }),
  });
};

export const useDeleteDietPlanFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: DietPlanFile) => {
      await supabase.storage.from(BUCKET).remove([file.file_path]);
      const { error } = await supabase.from('client_diet_plan_files').delete().eq('id', file.id);
      if (error) throw error;
      return file;
    },
    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files', file.client_id] });
      if (file.diet_plan_id) qc.invalidateQueries({ queryKey: ['client_diet_plan_files', 'plan', file.diet_plan_id] });
      toast.success('PDF removed');
    },
    onError: (e: any) => toast.error('Delete failed', { description: e.message }),
  });
};

export const useReplaceDietPlanFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, newFile }: { existing: DietPlanFile; newFile: File }) => {
      const safeName = newFile.name.replace(/[^\w.\-]+/g, '_');
      const path = `${existing.client_id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, newFile, { upsert: false, contentType: newFile.type || 'application/pdf' });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from('client_diet_plan_files')
        .update({
          file_name: newFile.name,
          file_path: path,
          mime_type: newFile.type || 'application/pdf',
          file_size: newFile.size,
        })
        .eq('id', existing.id);
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      // remove old object
      await supabase.storage.from(BUCKET).remove([existing.file_path]);
      return { ...existing, file_path: path, file_name: newFile.name };
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files', row.client_id] });
      if (row.diet_plan_id) qc.invalidateQueries({ queryKey: ['client_diet_plan_files', 'plan', row.diet_plan_id] });
      toast.success('PDF replaced');
    },
    onError: (e: any) => toast.error('Replace failed', { description: e.message }),
  });
};

export const getDietPlanFileSignedUrl = async (filePath: string, expiresInSeconds = 3600) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
};

/**
 * Publish a diet plan: marks the plan + all its attached PDF files as
 * client-visible. Portal clients (PWA) can only see published plans/files.
 */
export const usePublishDietPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, plan }: { planId: string; plan?: any }) => {
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // 1. Mark the plan as published + active
      const { error: planErr } = await supabase
        .from('diet_plans')
        .update({ is_published: true, published_at: now, status: 'active' })
        .eq('id', planId);
      if (planErr) throw planErr;

      // 2. Mark any existing file records as published
      const { error: filesErr } = await supabase
        .from('client_diet_plan_files')
        .update({ is_published: true, published_at: now, published_by: userData.user?.id ?? null })
        .eq('diet_plan_id', planId);
      if (filesErr) throw filesErr;

      // 3. Auto-generate a PDF and upload it so the client can download it immediately
      if (plan) {
        try {
          const blob = await generateDietPlanPdfBlob(plan);
          if (blob) {
            const fileName = `${plan.plan_name?.replace(/[^a-z0-9]/gi, '_') ?? 'diet_plan'}_${Date.now()}.pdf`;
            const filePath = `${plan.client_id}/${planId}/${fileName}`;

            const { error: uploadErr } = await supabase.storage
              .from(BUCKET)
              .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });

            if (!uploadErr) {
              // Insert or upsert the file record so the PWA can list it
              await supabase.from('client_diet_plan_files').upsert(
                {
                  client_id: plan.client_id,
                  diet_plan_id: planId,
                  file_name: fileName,
                  file_path: filePath,
                  mime_type: 'application/pdf',
                  is_published: true,
                  published_at: now,
                  published_by: userData.user?.id ?? null,
                },
                { onConflict: 'diet_plan_id,file_path' }
              );
            }
          }
        } catch {
          // PDF generation failure should not block the publish action
        }
      }

      return { planId };
    },
    onSuccess: ({ planId }) => {
      qc.invalidateQueries({ queryKey: ['diet_plans'] });
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files', 'plan', planId] });
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files'] });
      toast.success('Diet plan published — PDF generated and visible in client app');
    },
    onError: (e: any) => toast.error('Publish failed', { description: e.message }),
  });
};

/**
 * Unpublish a diet plan: hides plan + all attached PDF files from the client app.
 */
export const useUnpublishDietPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const { error: planErr } = await supabase
        .from('diet_plans')
        .update({ is_published: false, published_at: null })
        .eq('id', planId);
      if (planErr) throw planErr;

      const { error: filesErr } = await supabase
        .from('client_diet_plan_files')
        .update({ is_published: false, published_at: null, published_by: null })
        .eq('diet_plan_id', planId);
      if (filesErr) throw filesErr;

      return { planId };
    },
    onSuccess: ({ planId }) => {
      qc.invalidateQueries({ queryKey: ['diet_plans'] });
      qc.invalidateQueries({ queryKey: ['client_diet_plan_files', 'plan', planId] });
      toast.success('Diet plan unpublished — hidden from client app');
    },
    onError: (e: any) => toast.error('Unpublish failed', { description: e.message }),
  });
};
