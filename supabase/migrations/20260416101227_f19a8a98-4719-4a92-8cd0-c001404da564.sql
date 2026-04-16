
-- 1. Add neck_cm to client_measurements
ALTER TABLE public.client_measurements ADD COLUMN IF NOT EXISTS neck_cm numeric;

-- 2. Add PDF fields to diet_plans
ALTER TABLE public.diet_plans ADD COLUMN IF NOT EXISTS pdf_file_path text;
ALTER TABLE public.diet_plans ADD COLUMN IF NOT EXISTS pdf_file_name text;
ALTER TABLE public.diet_plans ADD COLUMN IF NOT EXISTS pdf_uploaded_at timestamp with time zone;

-- 3. Create private storage bucket for diet PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('diet-pdfs', 'diet-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS policies for diet-pdfs bucket
-- Team members (non-portal) can do everything
CREATE POLICY "Team can upload diet PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diet-pdfs' AND NOT public.is_portal_client()
);

CREATE POLICY "Team can view diet PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diet-pdfs' AND NOT public.is_portal_client()
);

CREATE POLICY "Team can update diet PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'diet-pdfs' AND NOT public.is_portal_client()
);

CREATE POLICY "Team can delete diet PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'diet-pdfs' AND NOT public.is_portal_client()
);

-- Portal clients can view only their own client's PDFs
-- PDF path convention: {client_id}/{plan_id}/{filename}
CREATE POLICY "Portal clients can view own diet PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diet-pdfs'
  AND public.is_portal_client()
  AND (storage.foldername(name))[1] = public.get_portal_client_id()::text
);

-- 5. Diet plans RLS for portal clients (SELECT only their own)
CREATE POLICY "Portal clients can view own diet plans"
ON public.diet_plans FOR SELECT TO authenticated
USING (
  public.is_portal_client() AND client_id = public.get_portal_client_id()
);

-- 6. Diet plan days RLS for portal clients
CREATE POLICY "Portal clients can view own diet plan days"
ON public.diet_plan_days FOR SELECT TO authenticated
USING (
  public.is_portal_client()
  AND diet_plan_id IN (
    SELECT id FROM public.diet_plans WHERE client_id = public.get_portal_client_id()
  )
);
