-- 1. Add publish columns to client_diet_plan_files
ALTER TABLE public.client_diet_plan_files
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

CREATE INDEX IF NOT EXISTS idx_cdpf_published
  ON public.client_diet_plan_files (client_id, is_published);

-- 2. Add publish columns to diet_plans (chart-level state)
ALTER TABLE public.diet_plans
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 3. Replace portal-client SELECT policy on client_diet_plan_files
--    Portal clients can ONLY see their own *published* file rows.
DROP POLICY IF EXISTS diet_files_client_select ON public.client_diet_plan_files;

CREATE POLICY diet_files_client_select
  ON public.client_diet_plan_files
  FOR SELECT
  TO authenticated
  USING (
    is_portal_client()
    AND client_id = get_portal_client_id()
    AND is_published = true
  );

-- 4. Tighten the legacy portal SELECT policy on diet_plans so PWA only
--    sees chart rows that have been explicitly published.
DROP POLICY IF EXISTS "Portal clients can view own diet plans" ON public.diet_plans;

CREATE POLICY "Portal clients can view own published diet plans"
  ON public.diet_plans
  FOR SELECT
  TO authenticated
  USING (
    is_portal_client()
    AND client_id = get_portal_client_id()
    AND is_published = true
  );

-- 5. Same restriction on diet_plan_days (PWA shouldn't see meals of unpublished plans)
DROP POLICY IF EXISTS "Portal clients can view own diet plan days" ON public.diet_plan_days;

CREATE POLICY "Portal clients can view own published diet plan days"
  ON public.diet_plan_days
  FOR SELECT
  TO authenticated
  USING (
    is_portal_client()
    AND diet_plan_id IN (
      SELECT id FROM public.diet_plans
      WHERE client_id = get_portal_client_id()
        AND is_published = true
    )
  );