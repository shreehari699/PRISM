# Security

## Secrets

`GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must never reach the
browser.

- `src/lib/config/env.server.ts` imports the `server-only` package,
  which fails the build if that module is ever pulled into a client
  bundle.
- `src/lib/ai/`, `src/lib/research/`, `src/lib/usage/`, and
  `src/lib/supabase/admin.ts` all start with `import "server-only"` for
  the same reason.
- `src/lib/config/env.client.ts` only ever reads `NEXT_PUBLIC_*`
  variables — the one Next.js convention that actually determines what
  gets inlined into the client bundle. `env.server.ts` is the only place
  that reads the secret variables.
- `.gitignore` excludes every `.env*` file except `.env.example`
  (tracked deliberately, contains no real values).
- Nothing in this codebase `console.log`s an environment variable. The
  `/api/health` endpoint reports which required variables are *missing*
  by name, never their values.

## Row Level Security

RLS is enabled on every table in `supabase/migrations/`. The frontend is
never the authorization boundary — every server code path (Server
Components, Route Handlers, Server Actions) uses `src/lib/supabase/server.ts`,
which runs queries as the authenticated user via their session cookie,
so Postgres itself enforces ownership regardless of what the client
requests.

Two tiers of policy, by table:

1. **User-writable** (`profiles`, `projects`, `problem_statements`,
   `analysis_sessions`, `voice_sessions`): the signed-in user may
   directly create/read/update rows they own. This is legitimate user
   input — a problem statement, a project name, session navigation —
   not AI-generated content.
2. **Read-only to the owner, write-only via service role** (`analysis_phases`,
   `analysis_phase_history`, every phase-derived table —
   `stakeholders` through `reports` — and `usage_tracking`): a user can
   see their own data but cannot write to it directly through the
   Supabase client. Server code writes these tables with
   `src/lib/supabase/admin.ts` (the service-role client) only after
   independently re-validating that the authenticated user owns the
   target project. This is deliberate: without it, a malicious client
   could call the Supabase REST API directly and insert a fabricated
   `evidence_status: 'VERIFIED'` row, which would defeat the entire
   evidence system. `usage_tracking` gets the same treatment so a user
   cannot reset or inflate their own free-tier quota — increments go
   through the `increment_usage` Postgres function
   (`supabase/migrations/0008_usage_functions.sql`), grantable only to
   `service_role`.

See `supabase/migrations/0007_row_level_security.sql` for the actual
policies and `supabase/README.md` for the full table list.
`src/lib/services/phase-engine.ts` is the reference implementation of
this pattern: every read that decides whether a caller may act on a
session/phase runs on the user-scoped client (so RLS enforces it), and
only once that's proven does it use the admin client to write
`analysis_phases` / `analysis_phase_history`.

**Never rely exclusively on frontend authorization.** Every Route
Handler / Server Action that mutates a service-role-only table must
re-check `project.user_id === session.user.id` (or the equivalent join)
in application code before writing — RLS on the underlying table is the
backstop, not a substitute for that check, since the service-role client
bypasses RLS entirely.

## Input and output validation

- Every AI call site defines a Zod schema and passes it to
  `AiProvider.generateStructured`. The Gemini provider
  (`src/lib/ai/gemini-provider.ts`) asks the model to conform to that
  schema's JSON Schema representation, then **re-parses and validates
  the model's JSON output against the same Zod schema** before
  returning it — a schema-conformant request is never treated as
  sufficient on its own; malformed or non-conformant output is returned
  as a typed `invalid_output` result, never coerced or silently
  accepted.
- Research provider output (`src/lib/research/types.ts`) is normalized
  and schema-validated the same way — a provider response that doesn't
  match `researchSourceSchema` is a bug to surface, not a shape to
  guess around.
- Environment variables are Zod-validated at startup
  (`src/lib/config/env.schema.ts`); a misconfigured deployment fails
  with a specific, actionable message rather than an `undefined`
  propagating into a Supabase or Gemini client constructor.

## Free-tier usage limits

`src/lib/usage` enforces configurable daily/monthly request limits
before a request is allowed to spend AI or research quota. Reaching a
limit returns an explicit safe-mode result — the app never silently
falls through to metered/paid usage on the user's behalf.

## Dependencies

No secret material is committed. Dependencies were installed from the
public npm registry; none are pinned to a fork or private mirror.
`node_modules` is excluded from version control via `.gitignore`.

## Reporting a vulnerability

This is an early-stage internal project. If you find a security issue,
open an issue in this repository or contact Zero Degree directly rather
than disclosing it publicly.
