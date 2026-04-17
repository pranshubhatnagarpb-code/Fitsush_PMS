-- ============================================
-- OPTION A: Diet Plan PDFs (separate table)
-- ============================================

-- 1. Create private storage bucket for diet plan PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('diet-plan-pdfs', 'diet-plan-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create client_diet_plan_files table
CREATE TABLE IF NOT EXISTS public.client_diet_plan_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  diet_plan_id uuid NULL REFERENCES public.diet_plans(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text DEFAULT 'application/pdf',
  file_size bigint NULL,
  uploaded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdpf_client ON public.client_diet_plan_files(client_id);
CREATE INDEX IF NOT EXISTS idx_cdpf_plan ON public.client_diet_plan_files(diet_plan_id);

ALTER TABLE public.client_diet_plan_files ENABLE ROW LEVEL SECURITY;

-- RLS: internal staff (non-portal) full access
CREATE POLICY "diet_files_team_select" ON public.client_diet_plan_files
  FOR SELECT TO authenticated
  USING (NOT public.is_portal_client());

CREATE POLICY "diet_files_team_insert" ON public.client_diet_plan_files
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_portal_client());

CREATE POLICY "diet_files_team_update" ON public.client_diet_plan_files
  FOR UPDATE TO authenticated
  USING (NOT public.is_portal_client());

CREATE POLICY "diet_files_team_delete" ON public.client_diet_plan_files
  FOR DELETE TO authenticated
  USING (NOT public.is_portal_client());

-- RLS: portal client - select only own
CREATE POLICY "diet_files_client_select" ON public.client_diet_plan_files
  FOR SELECT TO authenticated
  USING (public.is_portal_client() AND client_id = public.get_portal_client_id());

-- Storage RLS for diet-plan-pdfs bucket
-- Path convention: {client_id}/{filename}
CREATE POLICY "diet_pdfs_team_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'diet-plan-pdfs' AND NOT public.is_portal_client())
  WITH CHECK (bucket_id = 'diet-plan-pdfs' AND NOT public.is_portal_client());

CREATE POLICY "diet_pdfs_client_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'diet-plan-pdfs'
    AND public.is_portal_client()
    AND (storage.foldername(name))[1] = public.get_portal_client_id()::text
  );

-- ============================================
-- OPTION B: Extend client_measurements
-- Add aliased columns matching requested names
-- ============================================
ALTER TABLE public.client_measurements
  ADD COLUMN IF NOT EXISTS weight numeric NULL,
  ADD COLUMN IF NOT EXISTS body_fat_percentage numeric NULL,
  ADD COLUMN IF NOT EXISTS waist numeric NULL,
  ADD COLUMN IF NOT EXISTS hip numeric NULL,
  ADD COLUMN IF NOT EXISTS chest numeric NULL,
  ADD COLUMN IF NOT EXISTS thigh numeric NULL,
  ADD COLUMN IF NOT EXISTS arm numeric NULL,
  ADD COLUMN IF NOT EXISTS neck numeric NULL,
  ADD COLUMN IF NOT EXISTS measurement_notes text NULL;

-- Backfill new columns from existing _kg/_cm/_pct columns where present
UPDATE public.client_measurements
SET
  weight = COALESCE(weight, weight_kg),
  body_fat_percentage = COALESCE(body_fat_percentage, body_fat_pct),
  waist = COALESCE(waist, waist_cm),
  hip = COALESCE(hip, hip_cm),
  chest = COALESCE(chest, chest_cm),
  thigh = COALESCE(thigh, thigh_cm),
  arm = COALESCE(arm, arm_cm),
  neck = COALESCE(neck, neck_cm),
  measurement_notes = COALESCE(measurement_notes, notes);