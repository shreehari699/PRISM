# PRISM Architecture

This document describes the foundation established so far and the shape
it's designed to grow into. Where something is planned but not yet
built, it's marked **(planned)** rather than described as if it exists.

## 1. Product model

PRISM never lets a user jump directly from a problem to an AI-generated
solution. The investigation is a fixed sequence of ten phases:

```
01 Problem Intelligence
02 Stakeholder & Pain Analysis
03 Existing Solution Intelligence
04 Gap Intelligence
05 Opportunity & Innovation
06 Market & Investment Intelligence
07 Technical Feasibility
08 Solution Consultant
09 POC / Validation
10 PRISM Intelligence Dossier
```

Defined in `src/lib/prism/phases.ts` as the single source of truth for
phase order, titles, descriptions, which logical agents own each phase,
and whether the phase requires explicit human approval before its
output can feed the next phase. Everything else (database schema,
orchestrator, UI) is expected to key off this file rather than
duplicating the phase list.

Five **project modes** (`src/lib/prism/modes.ts`) change what criteria
each phase evaluates against: `HACKATHON`, `PBL`, `STARTUP`, `RESEARCH`,
`ZERO_DEGREE`.

### Honesty mechanisms

Two things stop PRISM from becoming "AI that tells you your idea is
good":

- **Evidence status** (`src/lib/prism/evidence.ts`): every factual claim
  is tagged `VERIFIED`, `INFERENCE`, `ASSUMPTION`, `RECOMMENDATION`, or
  `UNKNOWN`. Nothing is presented as fact without one of these labels.
- **Final decision** (`src/lib/prism/decision.ts`): the terminal
  recommendation is one of `BUILD`, `RESEARCH_FURTHER`, `PARK`, `REJECT`,
  each requiring reasoning. The schema treats all four as equally valid
  outcomes — there's no structural bias toward `BUILD`.

Scores (`src/lib/prism/scoring.ts`) always carry a `basis`
(`ai_estimate` | `heuristic`), `reasoning`, and a `confidence` band —
never a bare number presented as a precise measurement.

## 2. Agentic orchestration

PRISM is deliberately **not** one large prompt. `src/lib/orchestrator/`
holds:

- **`agents.ts`** — a registry of 15 narrow, single-responsibility
  agents (Problem Analyst, Stakeholder Analyst, Pain Analyst, Research
  Agent, Existing Solution Agent, Gap Agent, Opportunity Agent,
  Innovation Agent, Market Agent, Investment Agent, Feasibility Agent,
  Solution Consultant, Validation Agent, Jury Agent, Report Generator),
  each mapped to the phase it belongs to.
- **`orchestrator.ts`** (`PrismOrchestrator`) — pure sequencing logic
  with no AI or database calls of its own:
  - `getActivePhase()` — which phase the project is currently on
  - `canEnterPhase(key)` — whether a phase may run yet (every
    approval-gated upstream phase must be approved; a failed upstream
    phase blocks entry until retried)
  - `getPhasesRequiringRegeneration(changedPhase)` — which downstream
    phases are now stale because an upstream phase's approved output
    changed
  - `buildExecutionContext(key)` — assembles what an agent run needs:
    project mode, that mode's evaluation criteria, the problem
    statement, and every upstream phase's output

**(planned)** The per-phase system instructions, prompts, and Zod output
schemas for the 14 agents beyond the Problem Analyst (see §2a) — this
foundation establishes where they plug in (`AiProvider.generateStructured`
via the phase registry), not their content.

### 2a. Phase engine and Phase 01 — Problem Intelligence

The first fully wired vertical slice, and the pattern every later phase
reuses:

- **`src/lib/agents/problem-analyst/`** — the Problem Analyst. `schema.ts`
  defines `problemAnatomySchema` (who/what/where/when/why, each an
  `EvidenceClaim`, plus `clarity`, `openQuestions`, and a `problemScore`).
  `prompt.ts` builds the system instruction and user prompt separately
  from the executor so the persona reads as one place — critically, it
  tells the model it has **no research at this phase**, so every
  evidence claim must be `INFERENCE` or `ASSUMPTION`, never `VERIFIED`.
  `index.ts` (`runProblemAnalyst`) calls `AiProvider.generateStructured`
  with an injectable provider parameter purely for testability.
- **`src/lib/phases/registry.ts`** — maps a `PrismPhaseKey` to its
  `{ schema, execute }`. Only `problem_intelligence` is registered;
  looking up any other phase returns `undefined` on purpose, which the
  phase engine turns into an honest `not_implemented` (HTTP 501) rather
  than a fake result.
- **`src/lib/services/phase-engine.ts`** — the generic engine every
  phase's `run` / `approve` / `regenerate` goes through:
  - `run` — rejects if the phase already has output (use `regenerate`
    instead), checks `PrismOrchestrator.canEnterPhase`, checks
    `checkUsage` before spending an AI call, writes a `running` row,
    invokes the registry executor, then persists `awaiting_approval` +
    output on success or `failed` + `error_message` on any
    `AiResult` failure — nothing is fabricated on failure.
  - `regenerate` — same, but first archives the current output to
    `analysis_phase_history` and bumps `version`; after a successful
    regeneration, flags any already-run downstream phases
    `needs_regeneration` via `orchestrator.getPhasesRequiringRegeneration`.
  - `approve` — only from `awaiting_approval`; stamps `approved_at` /
    `approved_by`, then advances `analysis_sessions.current_phase_key`
    to the orchestrator's newly-computed active phase.
  - Every write to `analysis_phases` / `analysis_phase_history` uses the
    **admin** client (service-role-only per SECURITY.md); every read
    that decides *whether* the caller may do so uses the **user-scoped**
    client, so RLS — not this file's logic — is what actually proves
    ownership before any admin write happens.
- **`src/lib/services/investigations.ts`** — `createInvestigation`
  creates `projects` → `problem_statements` → `analysis_sessions` in one
  call, entirely on the user-scoped client (these three tables are
  user-writable by design).
- **`src/lib/supabase/rows.ts`** — Zod schemas for the DB rows the
  services above read/write, since `database.types.ts` is still a
  placeholder (§5). Every row from `createUntypedClient` /
  `createUntypedAdminClient` is parsed through one of these rather than
  trusted as `any`.
- **API**: `POST /api/investigations` (start an investigation) and
  `GET`/`POST /api/sessions/[sessionId]/phases/[phaseKey]` (read state /
  dispatch `{ "action": "run" | "approve" | "regenerate" }`). Both
  require a real Supabase-authenticated session — there is no dev
  bypass, so they 401 until a sign-in flow exists.

Phases 02–10 extend this by adding an entry to the agent registry and,
where a phase needs more than one agent (e.g. Stakeholder Analyst + Pain
Analyst for Phase 02), having that phase's `execute` internally call both
and merge their output — the phase engine only ever sees one `AiResult`.

## 3. AI provider abstraction

`src/lib/ai/`:

- `types.ts` — `AiProvider` interface and `AiResult<T>`, a discriminated
  union (`ok` | `unavailable` | `invalid_output` | `error`) so every
  call site is forced to handle the model being unavailable or
  returning invalid output, rather than assuming success.
- `gemini-provider.ts` — the only implementation today. Converts the
  caller's Zod schema to JSON Schema (`z.toJSONSchema`) and asks Gemini
  for `responseMimeType: application/json` against that schema, then
  **re-validates the parsed JSON against the same Zod schema** — the
  model is asked to conform, but its output is never trusted just
  because it asked to. A model-not-found error is detected and reported
  as `unavailable` rather than a raw 500, so a deprecated
  `GEMINI_MODEL` degrades gracefully.
- `index.ts` — `getAiProvider()` factory reads `GEMINI_MODEL` from
  server env; nothing else in the codebase should import
  `gemini-provider.ts` directly, so swapping providers later is a
  one-file change.

## 4. Research provider abstraction

`src/lib/research/`:

- `types.ts` — the normalized `ResearchSource` shape (title, url,
  publisher, sourceType, publishedDate, retrievedAt, snippet, evidence,
  relevance, confidence) every provider must return, and a
  discriminated `ResearchResult` (`ok` | `unavailable` | `error`) so
  "no provider configured" is never confused with "verified zero
  results."
- `providers/none.ts` — the default. Reports unavailability honestly.
- `providers/tavily.ts` — a real implementation against the Tavily
  search API, used when `RESEARCH_PROVIDER=tavily`.
- `classify.ts` — best-effort domain-based classification into the nine
  source categories (academic, government, industry, startup,
  commercial, international, open_source, technology, market) for
  providers that don't report a category themselves.
- `index.ts` — `getResearchProvider()` factory. `serpapi` / `bing` are
  reserved enum values that throw a clear "not implemented" error rather
  than silently falling back to fabricated results.

PRISM never fabricates companies, papers, URLs, or statistics — a
research call either returns real normalized sources, or an explicit
`unavailable`/`error` state the UI must show as such.

## 5. Database (Supabase / Postgres)

Full schema in `supabase/migrations/`, applied in filename order:

- `profiles` — one row per `auth.users` row (auto-provisioned via
  trigger)
- `projects` → `problem_statements` → `analysis_sessions` →
  `analysis_phases` (+ `analysis_phase_history` for regenerated output)
- Phase-derived tables: `stakeholders`, `pain_points`,
  `research_sources`, `existing_solutions`, `solution_comparisons`,
  `gaps`, `opportunities`, `innovations`, `market_analysis`,
  `investment_analysis`, `feasibility_analysis`,
  `recommended_solutions`, `validation_results`
- `reports`, `voice_sessions`, `usage_tracking`

Every table uses UUID primary keys, foreign keys with appropriate
`on delete` behavior, `created_at`/`updated_at` timestamps, and indexes
on every foreign key used in a lookup. Row Level Security is enabled on
every table — see `SECURITY.md` for the policy design.

`src/lib/supabase/`:

- `client.ts` — browser client (publishable key only)
- `server.ts` — Server Component / Route Handler / Server Action client
  (still the publishable key — runs as the authenticated user, RLS
  enforces ownership)
- `admin.ts` — service-role client, for the narrow set of operations
  that must bypass RLS (e.g. usage tracking, phase output); every call
  site re-checks ownership server-side before using it. Also exports
  `createUntypedAdminClient`/`DbClient` — see below.
- `middleware.ts` + root `middleware.ts` — refreshes the auth session on
  every request
- `rows.ts` — Zod row schemas + DTO mappers for tables not yet in
  `database.types.ts`'s placeholder (projects, problem_statements,
  analysis_sessions, analysis_phases). `createUntypedClient` (server.ts)
  and `createUntypedAdminClient` (admin.ts) are the corresponding
  clients without the `Database` generic — still RLS-enforced for the
  former, service-role for the latter; only the TypeScript typing
  differs from `createClient`/`createAdminClient`.

## 6. Usage tracking / free-tier safety

`src/lib/usage/` tracks AI and research requests per user per day and
per month (`usage_tracking` table, incremented atomically via the
`increment_usage` Postgres function so concurrent requests can't race a
read-modify-write). `checkUsage()` must be called — and its `allowed`
flag respected — before spending an AI or research call; limits are
configurable via `USAGE_DAILY_AI_REQUEST_LIMIT` etc. Reaching a limit
returns a safe-mode result with a reason string, never a silent
fallback to paid usage.

## 7. Design system

`src/app/globals.css` defines the token set (OKLCH-based neutral
graphite palette, a single reserved "prism" accent hue, and dedicated
evidence-status colors) under `@theme inline`, with light/dark handled
via `.dark` overrides. `src/components/ui/` holds hand-authored
shadcn/ui-pattern components (Button, Card, Input, Label, Badge,
Progress, Separator) built on Radix primitives + `class-variance-authority`
— the shadcn CLI registry (`ui.shadcn.com`) isn't reachable from this
environment's network policy, so components are written directly in the
same convention shadcn's generator would have produced, and remain
regenerable by that CLI in an environment where it is reachable.

`prefers-reduced-motion` is respected both globally (CSS) and in the one
current animated component (`HeroReveal`, via Framer Motion's
`useReducedMotion`).

**(planned)** The full investigation UI flow (problem input, phase
review/approval screens, dossier view), the cinematic intro, the voice
consultant abstraction, and 3D phase visualization (React Three Fiber
and Drei are installed but not yet wired into any route).

## 8. What's explicitly deferred

Per the scope of this foundation pass, the following are intentionally
**not** implemented yet, so they aren't half-built:

- Authentication UI / sign-in flow (Supabase Auth is wired at the
  client/server/middleware level, and `/api/investigations` +
  `/api/sessions/.../phases/...` genuinely require a real authenticated
  session — but no login page exists yet, so there's currently no way to
  obtain one through the UI)
- Any investigation UI (problem input form, phase review/approval
  screens, dossier view) — Phase 01 exists as a tested API + service
  layer only; see §2a
- Phases 02–10's agents, schemas, and prompts (the registry and engine
  they plug into are done — see §2a)
- PDF upload handling for the `pdf_upload` input method (the schema and
  `source_file_url` column exist; nothing populates or reads a file yet)
- The voice consultant and cinematic opening experience
- The final Intelligence Dossier renderer
- `serpapi` / `bing` research providers
