# PRISM database migrations

Plain numbered SQL files in `migrations/`, applied in filename order. No
seed data — PRISM never fabricates project data, so there's nothing
meaningful to seed beyond an empty schema.

## Applying migrations

**Supabase CLI (recommended):**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Manual (Supabase Studio SQL editor):** open each file in
`migrations/` in order and run it.

## What's in here

| File | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, shared `set_updated_at()` trigger function |
| `0002_profiles.sql` | `profiles`, auto-provisioning trigger on `auth.users` |
| `0003_projects_and_problem_statements.sql` | `projects`, `problem_statements` |
| `0004_analysis_sessions_and_phases.sql` | `analysis_sessions`, `analysis_phases`, `analysis_phase_history` |
| `0005_phase_data_tables.sql` | Every phase-derived table: stakeholders, pain points, research sources, existing solutions, gaps, opportunities, innovations, market/investment/feasibility analysis, recommended solutions, validation results |
| `0006_reports_voice_usage.sql` | `reports`, `voice_sessions`, `usage_tracking` |
| `0007_row_level_security.sql` | RLS policies for every table above |
| `0008_usage_functions.sql` | `increment_usage()` — atomic, service-role-only usage counter |
| `0009_profiles_insert_policy_and_backfill.sql` | Missing `profiles` INSERT policy (matches SECURITY.md's documented model) + one-time backfill for any `auth.users` row that predates the auto-provisioning trigger |
| `0010_profiles_id_defaults_to_auth_uid.sql` | `profiles.id` now defaults to `auth.uid()`, so a client-provisioned profile insert can never disagree with the `profiles_insert_own` RLS check that validates it |

See `SECURITY.md` at the repo root for the RLS design rationale.

## Regenerating TypeScript types

After applying migrations to a real project:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
```

Until that's been run against a real project, `database.types.ts` is a
placeholder — see the comment at the top of that file.
