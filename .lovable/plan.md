# Migration Plan (Revised — Minimum Viable Migration)

Scope intentionally trimmed. AI features stay on the current backend and are **not** migrated in this pass.

## In Scope
- 15 public-schema tables + their RLS policies
- 15 SQL migrations in `supabase/migrations/`
- DB helper functions: `update_updated_at_column()`, `is_portal_client()`, `get_portal_client_id()`
- Auth (team email/password + portal email-or-phone/password)
- Storage buckets: `diet-plan-pdfs` (active), `diet-pdfs` (legacy)
- Edge function: `enable-portal-access` only

## Out of Scope (this pass)
- Edge functions: `generate-diet-plan`, `generate-recipe`
- `LOVABLE_API_KEY` and any AI gateway logic
- Legacy `api/*.js`, `server.js`, `src/pages/api/*` (will be removed from repo as cleanup, not migrated)
- Unused `src/integrations/supabase/auth-middleware.ts` (TanStack-only; project uses react-router-dom)

## Migration Steps

### Step A — Schema + Migrations
1. Create new Supabase project; capture project ref, DB URL, anon key, service role key.
2. Update `supabase/config.toml` `project_id` to the new ref.
3. `supabase link --project-ref <new>`
4. `supabase db push` — applies all 15 migrations.
5. Verify: 15 tables present, RLS enabled, both helper functions exist, policies match inventory.

### Step B — Table Data
1. From source DB: `pg_dump --data-only --schema=public --no-owner --no-privileges` (exclude `auth.*`).
2. Restore to new DB via `psql`.
3. Export `auth.users` from source via Auth Admin API; re-import into new project preserving UUIDs so `client_portal_users.user_id` keeps working.

### Step C — Storage Buckets
1. Create `diet-plan-pdfs` (private) and `diet-pdfs` (private) in new project.
2. Copy objects bucket-to-bucket via service-role script, preserving `file_path` values stored in `client_diet_plan_files`.

### Step D — Edge Function
1. Deploy only `enable-portal-access`:
   `supabase functions deploy enable-portal-access`
2. Set secrets on new project:
   `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... SUPABASE_URL=...`
   (`SUPABASE_URL` and service/anon keys are typically auto-injected; verify in dashboard.)

### Step E — Point PMS/PWA at New Project
1. Update `.env`:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
2. Regenerate `src/integrations/supabase/types.ts` against the new project ref.
3. Smoke test: team login, enable portal access for a client, portal login, PDF upload + publish + signed-URL fetch.

## Auth Settings to Mirror Manually in New Project
- Email/password provider: enabled
- Phone provider: enabled if portal phone-login is needed
- Site URL + redirect URLs (for `emailRedirectTo` in team signup)
- Disable "Confirm email" requirement OR keep `email_confirm: true` flow — current code assumes admin-created portal users are auto-confirmed.

---

## Answers to Your Questions

1. **Ready to apply migrations?** I can prepare and verify the migration files in this repo right now. Actual `supabase db push` against your new project must run from your local machine (or a CI runner) with the Supabase CLI authenticated to your account — I can't run it from here.

2. **Should you share the project ref + service role key?**
   - **Project ref: yes** — safe to share, paste it in chat. I'll update `supabase/config.toml` and the env files.
   - **Service role key: NO, do not paste it in chat.** It's a write-everything secret. Either:
     - Keep it on your machine and run the CLI commands yourself, or
     - Add it via the Supabase secrets UI on the new project (and locally as `SUPABASE_SERVICE_ROLE_KEY` for CLI).
   - **Anon (publishable) key: yes** — safe, goes into `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY`.

When you send the **project ref + anon key**, I'll: update `supabase/config.toml` and `.env`, verify migration ordering, and give you the exact CLI command sequence to run for Steps A–D.
