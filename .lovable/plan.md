
# Migration Inventory: Lovable Cloud → Self-Owned Supabase

This is a read-only inventory. Nothing will be changed yet. Use it as your migration checklist and dependency map.

---

## 1. Database Tables (15 total)

**Core PMS (no portal RLS, simple `authenticated = true` policies):**
- `clients` — includes `portal_access_enabled` flag
- `employees`
- `appointments`
- `receivables`
- `lead_followups`
- `diet_plans` — has `is_published`, `published_at`, plus legacy `pdf_file_path`, `pdf_file_name`, `pdf_uploaded_at`
- `diet_plan_days`
- `diet_options`
- `diet_chart_templates`

**Portal-related (strict RLS using `is_portal_client()` / `get_portal_client_id()`):**
- `client_portal_users` — links `auth.users.id` → `clients.id`
- `client_measurements` — extended body metrics (weight, bmi, waist, hip, chest, arm, thigh, neck, body_fat, muscle_mass, etc.)
- `client_blood_reports` — JSONB `extracted_data`
- `client_feedback`
- `client_diet_plan_files` — canonical published-PDF metadata table (publish gating via `is_published`)

**Note:** No actual FK constraints exist — relations are by `*_id` convention only.

---

## 2. SQL Migrations (15 files in `supabase/migrations/`)

Apply in filename order (already chronological):
```
20260117115035  – initial schema
20260124094357
20260224075738
20260225060817
20260314102002
20260316074338
20260318075837
20260319082300
20260401175500  – add custom_title to diet_plans
20260415104626  – portal users + RLS scaffolding
20260415104703
20260415110450
20260416101227  – measurements expansion + diet plan PDF
20260417053943  – client_diet_plan_files + bucket
20260420080522  – publish workflow (is_published / published_at)
```

Plus one stray top-level file: `add_supplements_column.sql` (already in `clients` schema; verify before re-running).

**Database functions to recreate** (defined inside migrations):
- `update_updated_at_column()` (trigger helper, currently unused — no triggers in DB)
- `is_portal_client()` — SECURITY DEFINER
- `get_portal_client_id()` — SECURITY DEFINER

---

## 3. Supabase Client Files & Env Vars

**Client files (auto-generated — do NOT hand-edit, but they read env vars):**
- `src/integrations/supabase/client.ts` — browser client (anon key)
- `src/integrations/supabase/client.server.ts` — admin client (service role)
- `src/integrations/supabase/auth-middleware.ts` — server fn middleware (uses `getClaims`)
- `src/integrations/supabase/types.ts` — generated DB types (regenerate after migration)

**Env vars (`.env`, currently pointing at Lovable Cloud project `zkmfghujpmpggnzfkyvw`):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

**Server-side / edge function secrets:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `LOVABLE_API_KEY` ← **Lovable-Cloud-specific** (see §7)

**Project config:** `supabase/config.toml` has `project_id = "zkmfghujpmpggnzfkyvw"` — must be updated.

---

## 4. Auth Flows

**Single shared Supabase Auth pool used by two audiences:**

a. **Internal team (PMS):** email + password sign-in via `src/contexts/AuthContext.tsx`
   - `signInWithPassword`, `signUp` (with `emailRedirectTo`), `signOut`, `onAuthStateChange`, `getSession`
   - Login page: `src/pages/Login.tsx`

b. **Portal clients (PWA):** real `auth.users` records created server-side by the `enable-portal-access` edge function
   - Linked to `clients` row via `client_portal_users.user_id`
   - Login supports email **or** phone + password
   - RLS gating uses `is_portal_client()` / `get_portal_client_id()` helpers

**Auth settings to recreate manually in new Supabase project:**
- Email/password provider enabled
- Phone provider enabled (if SMS sign-in intended; currently `phone_confirm: true` is set without sending OTP)
- Email auto-confirm policy (currently `email_confirm: true` is forced for portal users via admin API)
- Site URL / redirect URLs for `emailRedirectTo`
- Password min length / HIBP setting
- Any Google OAuth provider (not currently wired)

---

## 5. Storage Buckets

Two **private** buckets exist:
- `diet-plan-pdfs` ← active canonical bucket (referenced by `useDietPlanFiles.ts`)
- `diet-pdfs` ← legacy / older bucket (still listed in Cloud, may hold older files; check before deleting)

**Code touching storage:** only `src/hooks/useDietPlanFiles.ts` (upload, replace, remove, `createSignedUrl`).

**Migration steps:** create both buckets as private, copy existing objects (download from Lovable Cloud Storage UI or via service-role script, re-upload to new project preserving paths), then re-point env vars. No bucket policies are stored in migrations — RLS on `storage.objects` (if any) must be re-created manually.

---

## 6. Edge Functions / Server-Side Flows

**Supabase Edge Functions (Deno, in `supabase/functions/`):**
1. `enable-portal-access` — admin-creates auth user, sets password, links to client, flips `portal_access_enabled`. Uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
2. `generate-diet-plan` — calls Lovable AI Gateway with `LOVABLE_API_KEY`.
3. `generate-recipe` — calls Lovable AI Gateway with `LOVABLE_API_KEY`.

**Other server-side surfaces in repo (likely legacy/unused once on Supabase):**
- `api/diet-plan.js`, `api/generate-recipe.js`, `api/test.js`, `api/diet-plan-debug.js`
- `server.js`, `src/pages/api/diet-plan.js`
- `src/integrations/supabase/auth-middleware.ts` (TanStack-style; project actually uses react-router-dom — unused)

**Action:** Edge functions must be deployed via `supabase functions deploy <name>` to the new project, and their secrets re-added with `supabase secrets set`.

---

## 7. Lovable-Cloud-Specific Items to Recreate Manually

These do NOT come for free in a self-owned Supabase and need replacement:

| Item | Where used | Replacement on self-owned Supabase |
|---|---|---|
| `LOVABLE_API_KEY` (AI Gateway) | `generate-diet-plan`, `generate-recipe` | Use direct OpenAI / Google AI / Anthropic API key; rewrite the `fetch` URL + `Authorization` header in both edge functions |
| Lovable Cloud auto-confirm of email/phone for admin-created users | `enable-portal-access` calls `email_confirm: true` | Works on standard Supabase too, but verify "Confirm email" setting doesn't reject it |
| Cloud-managed secrets UI | All `Deno.env.get(...)` calls | Use `supabase secrets set KEY=value` |
| Auto-generated `src/integrations/supabase/types.ts` | App-wide | Run `supabase gen types typescript --project-id <new> > src/integrations/supabase/types.ts` |
| `client.ts` / `client.server.ts` auto-regen | Build pipeline | These files become hand-maintained — keep current content, only env values change |
| Lovable's automatic edge function deploy | All 3 edge functions | Manual `supabase functions deploy` per function |
| Storage bucket data | `diet-plan-pdfs`, `diet-pdfs` | Manual object copy (no migration tool) |
| Existing `auth.users` records (team + portal clients) | Auth | Export via Supabase Auth Admin API on source, re-import on target — passwords are bcrypt-hashed and **can** be migrated, but only via the Auth admin import endpoint |
| Existing table data | All tables | `pg_dump --data-only` from source DB URL → restore to target |

---

## Migration Checklist (recommended order)

```text
1. Create new Supabase project; capture URL, anon key, service role key, DB URL.
2. supabase link --project-ref <new>
3. supabase db push   (applies all 15 migrations + db functions)
4. Verify schema + RLS + helper functions exist.
5. Create storage buckets: diet-plan-pdfs (private), diet-pdfs (private).
6. Copy storage objects from old → new.
7. pg_dump --data-only --schema=public from old, psql restore to new
   (skip auth.* — handled separately).
8. Export auth.users from old project (Auth Admin API), import into new.
   Re-link client_portal_users.user_id values if UUIDs change (prefer
   preserving UUIDs during import).
9. Replace LOVABLE_API_KEY usage in generate-diet-plan + generate-recipe
   with chosen AI provider + key.
10. supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... LOVABLE_API_KEY/OPENAI_API_KEY=...
11. supabase functions deploy enable-portal-access generate-diet-plan generate-recipe
12. Update .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID).
13. Update supabase/config.toml project_id.
14. Regenerate src/integrations/supabase/types.ts.
15. Configure Auth providers + Site URL + redirect URLs in new project.
16. Smoke test: team login, enable portal access for one client, portal login,
    upload+publish PDF, fetch PDF via signed URL, AI generation endpoints.
```

---

## Dependency Map

```text
PMS UI ── react-router-dom ── AuthContext (supabase.auth)
                              │
                              └── supabase (browser client) ──┐
                                                              │
Edge: enable-portal-access ── service role ── auth.admin ─────┤
                              └── clients, client_portal_users┤
                                                              ▼
                                                         Postgres + RLS
                                                              ▲
Edge: generate-diet-plan ── LOVABLE_API_KEY ── (AI gateway)   │
Edge: generate-recipe    ── LOVABLE_API_KEY ── (AI gateway)   │
                                                              │
Storage: diet-plan-pdfs (private) ◄── useDietPlanFiles ───────┘
         diet-pdfs (legacy, private)

Portal RLS gate: is_portal_client() + get_portal_client_id()
   → governs SELECT/INSERT on client_measurements, client_blood_reports,
     client_feedback, client_diet_plan_files (published only),
     diet_plans (published only), diet_plan_days (published only).
```

---

Tell me when you want to proceed, and whether you want to keep `LOVABLE_API_KEY`-style AI calls (need a replacement provider choice) or strip the AI features for the migration cut.
