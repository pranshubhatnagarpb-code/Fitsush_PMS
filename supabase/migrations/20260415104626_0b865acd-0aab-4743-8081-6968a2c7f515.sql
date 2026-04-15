
-- ============================================================
-- EXISTING PMS SCHEMA
-- ============================================================

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  anniversary_date DATE,
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  health_conditions TEXT[],
  total_receivables DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  gender text,
  skin_type text,
  hair_type text,
  goal text,
  diet_preference text,
  total_fees numeric DEFAULT 0,
  service_start_date date,
  service_duration_months integer,
  portal_access_enabled boolean NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  department text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ADD COLUMN employee_id uuid REFERENCES public.employees(id);

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.diet_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
  name TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  is_vegetarian BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.diet_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','active','completed','approved'])),
  week_number integer DEFAULT 1,
  ai_plan_data jsonb,
  is_ai_generated boolean DEFAULT false,
  custom_title text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.diet_plan_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  breakfast_option_id UUID REFERENCES public.diet_options(id),
  lunch_option_id UUID REFERENCES public.diet_options(id),
  snacks_option_id UUID REFERENCES public.diet_options(id),
  dinner_option_id UUID REFERENCES public.diet_options(id),
  total_calories INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  followup_date DATE NOT NULL,
  followup_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.diet_chart_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS on existing tables (team = full access)
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_chart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all diet_options" ON public.diet_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_options" ON public.diet_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_options" ON public.diet_options FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_options" ON public.diet_options FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all diet_plans" ON public.diet_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_plans" ON public.diet_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_plans" ON public.diet_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_plans" ON public.diet_plans FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all diet_plan_days" ON public.diet_plan_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_plan_days" ON public.diet_plan_days FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_plan_days" ON public.diet_plan_days FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_plan_days" ON public.diet_plan_days FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all receivables" ON public.receivables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert receivables" ON public.receivables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update receivables" ON public.receivables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete receivables" ON public.receivables FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all lead_followups" ON public.lead_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lead_followups" ON public.lead_followups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lead_followups" ON public.lead_followups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete lead_followups" ON public.lead_followups FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all diet_chart_templates" ON public.diet_chart_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_chart_templates" ON public.diet_chart_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_chart_templates" ON public.diet_chart_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_chart_templates" ON public.diet_chart_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update employees" ON public.employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete employees" ON public.employees FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Timestamps trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON public.diet_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lead_followups_updated_at BEFORE UPDATE ON public.lead_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_diet_chart_templates_updated_at BEFORE UPDATE ON public.diet_chart_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_clients_date_of_birth ON public.clients(date_of_birth);
CREATE INDEX idx_clients_anniversary_date ON public.clients(anniversary_date);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_diet_plans_client ON public.diet_plans(client_id);
CREATE INDEX idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX idx_receivables_status ON public.receivables(status);
CREATE INDEX idx_lead_followups_date ON public.lead_followups(followup_date);

-- ============================================================
-- NEW: CLIENT PORTAL TABLES
-- ============================================================

-- 1. client_portal_users
CREATE TABLE public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (client_id)
);
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_portal_client()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_portal_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT client_id FROM public.client_portal_users
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- Portal users RLS
CREATE POLICY "portal_users_select_own" ON public.client_portal_users FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "portal_users_team_select" ON public.client_portal_users FOR SELECT TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "portal_users_team_insert" ON public.client_portal_users FOR INSERT TO authenticated WITH CHECK (NOT public.is_portal_client());
CREATE POLICY "portal_users_team_update" ON public.client_portal_users FOR UPDATE TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "portal_users_team_delete" ON public.client_portal_users FOR DELETE TO authenticated USING (NOT public.is_portal_client());

-- 2. client_measurements
CREATE TABLE public.client_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(6,2),
  body_fat_pct numeric(5,2),
  muscle_mass_kg numeric(6,2),
  bmi numeric(5,2),
  waist_cm numeric(6,2),
  hip_cm numeric(6,2),
  chest_cm numeric(6,2),
  arm_cm numeric(6,2),
  thigh_cm numeric(6,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurements_client_select" ON public.client_measurements FOR SELECT TO authenticated USING (client_id = public.get_portal_client_id());
CREATE POLICY "measurements_client_insert" ON public.client_measurements FOR INSERT TO authenticated WITH CHECK (public.is_portal_client() AND client_id = public.get_portal_client_id());
CREATE POLICY "measurements_team_select" ON public.client_measurements FOR SELECT TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "measurements_team_insert" ON public.client_measurements FOR INSERT TO authenticated WITH CHECK (NOT public.is_portal_client());
CREATE POLICY "measurements_team_update" ON public.client_measurements FOR UPDATE TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "measurements_team_delete" ON public.client_measurements FOR DELETE TO authenticated USING (NOT public.is_portal_client());

-- 3. client_blood_reports
CREATE TABLE public.client_blood_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  report_title text NOT NULL DEFAULT 'Blood Report',
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_blood_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blood_reports_client_select" ON public.client_blood_reports FOR SELECT TO authenticated USING (client_id = public.get_portal_client_id());
CREATE POLICY "blood_reports_client_insert" ON public.client_blood_reports FOR INSERT TO authenticated WITH CHECK (public.is_portal_client() AND client_id = public.get_portal_client_id());
CREATE POLICY "blood_reports_team_select" ON public.client_blood_reports FOR SELECT TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "blood_reports_team_insert" ON public.client_blood_reports FOR INSERT TO authenticated WITH CHECK (NOT public.is_portal_client());
CREATE POLICY "blood_reports_team_update" ON public.client_blood_reports FOR UPDATE TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "blood_reports_team_delete" ON public.client_blood_reports FOR DELETE TO authenticated USING (NOT public.is_portal_client());

-- 4. client_feedback
CREATE TABLE public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  feedback_by text NOT NULL,
  feedback_text text NOT NULL,
  feedback_type text NOT NULL DEFAULT 'general',
  is_visible_to_client boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_client_select" ON public.client_feedback FOR SELECT TO authenticated USING (client_id = public.get_portal_client_id() AND is_visible_to_client = true);
CREATE POLICY "feedback_team_select" ON public.client_feedback FOR SELECT TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "feedback_team_insert" ON public.client_feedback FOR INSERT TO authenticated WITH CHECK (NOT public.is_portal_client());
CREATE POLICY "feedback_team_update" ON public.client_feedback FOR UPDATE TO authenticated USING (NOT public.is_portal_client());
CREATE POLICY "feedback_team_delete" ON public.client_feedback FOR DELETE TO authenticated USING (NOT public.is_portal_client());

-- Portal table indexes
CREATE INDEX idx_client_portal_users_user_id ON public.client_portal_users(user_id);
CREATE INDEX idx_client_portal_users_client_id ON public.client_portal_users(client_id);
CREATE INDEX idx_client_measurements_client_date ON public.client_measurements(client_id, measurement_date);
CREATE INDEX idx_client_blood_reports_client_date ON public.client_blood_reports(client_id, report_date);
CREATE INDEX idx_client_feedback_client_id ON public.client_feedback(client_id);

-- Portal table triggers
CREATE TRIGGER update_client_portal_users_updated_at BEFORE UPDATE ON public.client_portal_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_measurements_updated_at BEFORE UPDATE ON public.client_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_blood_reports_updated_at BEFORE UPDATE ON public.client_blood_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_feedback_updated_at BEFORE UPDATE ON public.client_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
