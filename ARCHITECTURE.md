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
schemas for the 9 agents beyond the Problem Analyst, Stakeholder
Analyst, Pain Analyst, Research Agent, Existing Solution Agent, and Gap
Agent (see §2a/§2b/§2c/§2d) — this foundation establishes where they
plug in (`AiProvider.generateStructured` via the phase registry), not
their content.

### 2a. Phase engine and Phase 01 — Problem Intelligence (reference implementation)

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
  `{ schema, execute }`. Only `problem_intelligence` and
  `stakeholder_pain` are registered; looking up any other phase returns
  `undefined` on purpose, which the phase engine turns into an honest
  `not_implemented` (HTTP 501) rather than a fake result.
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

### 2b. Phase 02 — Stakeholder & Pain Intelligence

The first phase to actually exercise the "more than one agent per
phase" pattern §2a anticipated, and to depend on a prior phase's output
rather than only the raw problem statement:

- **`src/lib/agents/stakeholder-analyst/`** — identifies every
  stakeholder implicated by the *approved* Phase 01 output. Produces a
  `DraftStakeholder[]` with a tier (`PRIMARY`/`SECONDARY`/`TERTIARY`), one
  or more roles (`USER`, `CONSUMER`, `BUYER`, `BENEFICIARY`, `OPERATOR`,
  `DECISION_MAKER`, `INFLUENCER`, `REGULATOR`, `IMPLEMENTER`,
  `AFFECTED_PARTY`), and a `decisionPower` on a four-level scale
  (`none`/`low`/`medium`/`high`) — `none` is a distinct, legitimate
  answer, not a euphemism for `low`, which is what actually lets the
  phase draw a real user-vs-buyer-vs-beneficiary distinction instead of
  flattening everyone onto the same 3-point scale. The prompt requires
  preserving any evidence status Phase 01 already assigned rather than
  silently upgrading or downgrading it.
- **`src/lib/agents/pain-analyst/`** — takes the problem anatomy *and*
  the draft stakeholder list as input and produces each stakeholder's
  pain, a `severityScore` per pain (raw 0-100 `dimensions` — severity,
  frequency, reach, consequence, urgency, currentSolutionSatisfaction —
  always bundled with an `overall: Score` whose `reasoning` must explain
  the number, never a bare comparative estimate presented as a
  measurement), which single pain is `primaryPain` (with mandatory
  reasoning about whether it's the real pain or a downstream symptom),
  `customerDistinction` (only `applicable: true` when this problem
  actually has divergent user/customer/buyer/beneficiary/operator
  roles), problem-specific `validationQuestions`, an honest
  `realityCheck` (four `ConfidenceLevel` ratings, where
  `INSUFFICIENT_EVIDENCE` is a first-class expected answer, not a
  failure), and a `consultantMessage` generated fresh from this
  analysis's actual findings.
- **`src/lib/phases/stakeholder-pain/`** — the composer. Calls the
  Stakeholder Analyst, then the Pain Analyst grounded in its output,
  then merges them into the final `StakeholderPainAnalysis`. It does
  **not** trust either model call to keep cross-references consistent:
  every stakeholder's `painPointIds` is *computed* from the Pain
  Analyst's `stakeholderLocalId` references (never asked of the model
  twice), and every reference — pain → stakeholder,
  `primaryPain`/`secondaryPains` → pain — is checked to actually resolve
  before the merged result is accepted; an unresolvable reference comes
  back as `invalid_output`, the same failure class a malformed JSON
  response would produce. Combined token usage from both calls is
  reported as a single `AiUsage`, so the phase engine's `checkUsage` /
  `recordUsage` treat one phase `run` as one billable unit regardless of
  how many model calls it took internally.
- **Dependency on Phase 01**: enforced entirely by the existing,
  unmodified `PrismOrchestrator.canEnterPhase` — Phase 02 cannot run
  until the `problem_intelligence` phase row is `approved`; missing,
  `awaiting_approval`, `needs_regeneration` (stale), or `failed` upstream
  states all produce the same `conflict` result Phase 01→02 gating
  already had tests for. No phase-02-specific gating code exists.
- **Persistence**: stored entirely in `analysis_phases.output_data`
  (jsonb), the same as Phase 01 — the normalized `stakeholders` /
  `pain_points` tables already in the schema are **not** populated by
  this pass. They're a reasonable target for a future cross-phase
  reporting/query layer, but populating them now would mean keeping two
  representations in sync for no requirement this phase actually has;
  the jsonb blob alone already satisfies persistence, RLS, approval, and
  regeneration.
- **Registered** in `src/lib/phases/registry.ts` exactly like Phase 01 —
  no new API routes, no route changes. `run` / `approve` / `regenerate`
  for `stakeholder_pain` go through the same
  `POST /api/sessions/[sessionId]/phases/[phaseKey]` endpoint.

### 2c. Phase 03 — Existing Solution Intelligence + live research

The first phase to actually call the research provider abstraction
(§4) — Phases 01–02 only ever called Gemini — and the first to depend
on *two* upstream phases (`problem_intelligence` AND `stakeholder_pain`
must both be approved). It answers "what already exists for this
problem?" from real Tavily search results, never from Gemini's own
training-data memory of companies or products:

- **`src/lib/agents/research-agent/`** — the research half of the
  phase, itself a small pipeline:
  - `question-generator.ts` (Gemini) — reads the approved Phase 01 +
    Phase 02 output and produces multiple targeted, deduplication-ready
    search queries across nine categories (`COMMERCIAL`, `STARTUP`,
    `GOVERNMENT`, `ACADEMIC`, `OPEN_SOURCE`, `INTERNATIONAL`,
    `TECHNOLOGY`, `WORKFLOW`, `ALTERNATIVE`) — never one catch-all
    query, and explicitly told to distrust its own memory.
  - `executor.ts` — plain code, no AI: deduplicates queries
    (case/whitespace-insensitive), runs each sequentially against the
    **existing** `ResearchProvider` from `src/lib/research` (no second
    Tavily client, no second research abstraction), continues past a
    failed query rather than aborting the batch, and deduplicates the
    resulting sources by URL. Every result is tagged with a
    `sourceLocalId` for cross-referencing and the query/category that
    produced it (`phaseSourceSchema` — an `.extend()` of the existing
    `researchSourceSchema`, not a parallel schema).
  - `index.ts` (`runResearchAgent`) — combines the two into one
    `research` usage charge: checks `checkUsage(userId, "research")`
    *before* even generating queries (so an exhausted budget costs
    nothing, not even a wasted Gemini call), and calls
    `recordUsage(userId, "research", 0)` exactly once after the whole
    batch, regardless of how many individual queries ran underneath —
    the same "one phase run, one charge" principle Phase 02 established
    for its two Gemini calls, just applied to the research quota
    instead of the AI quota (which the phase engine already handles
    generically around the whole phase run). An exhausted budget
    produces an `ok` result with `budgetExhausted: true`, not a
    failure — running out of free research capacity is a legitimate
    PRISM outcome, and the phase still returns a complete, honest
    result.
- **`src/lib/agents/existing-solution-agent/`** — takes the normalized
  sources plus real, code-computed research counts (never numbers the
  model made up) and extracts every credible existing solution they
  actually support, with full `EvidenceClaim` tagging throughout so
  "Company X provides a platform for Y" never silently becomes "X is
  the market leader." Every solution must cite at least one real
  `sourceIds` entry — enforced by the schema itself
  (`sourceIds: z.array(...).min(1)`), not just the prompt — and zero
  solutions is an explicitly valid, un-penalized result (`solutions`
  has no `.min(1)`, unlike Phase 02's stakeholders/pains). Comparison
  fields (stakeholder/pain coverage, accessibility, cost, scalability,
  geographic coverage) live on the same solution object rather than a
  separate nested type, since they're the same solution examined from
  a different angle, not a different entity. Fields the model can't
  determine hold the literal string `"UNKNOWN"` (never omitted) — a
  deliberate difference from Phase 01/02's `.optional()` convention,
  chosen because this phase's spec explicitly wants a required,
  always-present marker for "checked and couldn't determine," not an
  absent field indistinguishable from "wasn't asked."
- **`src/lib/phases/existing-solutions/`** — the composer. Runs the
  two steps above in sequence, then:
  - Validates every cross-reference before accepting the result: each
    solution's `sourceIds` must resolve to a source the research step
    actually returned, or the whole result comes back `invalid_output`
    — the same "don't trust either side to stay in sync" discipline
    Phase 02 applied to stakeholder/pain references.
  - Computes `stats` (sourcesFound, sourcesUsed, solutionsIdentified,
    queriesExecuted, researchFailures, budgetExhausted) and
    `researchCoverage` (`HIGH`/`MEDIUM`/`LOW`/`INSUFFICIENT` for seven
    of the nine query categories — the spec's own coverage section
    lists seven, deliberately excluding `WORKFLOW`/`ALTERNATIVE` from a
    dedicated line) **entirely in this file, from the pipeline's own
    counts** — there is no code path where a number in the final output
    came from asking the model. Coverage is a transparent, reproducible
    heuristic (source count weighted by the provider's own reported
    relevance), not a second model judgment call.
  - Combines token usage from both Gemini calls via the shared
    `combineUsage` helper (`src/lib/ai/combine-usage.ts`, promoted out
    of Phase 02's composer once a second phase needed the same
    pattern) so the engine's `ai` usage charge is still exactly one
    request per phase run.
- **Dependency on Phase 01 AND Phase 02**: enforced entirely by the
  existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  phase-03-specific gating code exists, same as Phase 02's single
  dependency on Phase 01.
- **`context.userId`**: Phase 03 is the first phase whose executor
  needs to check/record a usage quota (`research`) the generic phase
  engine doesn't already track for it. `ProjectContext` and
  `PhaseExecutionContext` (`src/lib/orchestrator/types.ts`) gained an
  optional `userId` field for exactly this — `PrismOrchestrator`
  threads it through `buildExecutionContext` unchanged for every other
  phase, which never reads it.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–02. `research_sources` — the normalized table already in
  the schema — is **not** populated by this pass, for the same
  reasoning as Phase 02's stakeholders/pain_points tables (§2b): the
  jsonb blob already satisfies every requirement this phase actually
  has, and a second persisted representation would only risk drifting
  from it.
- **Registered** in `src/lib/phases/registry.ts` exactly like Phases
  01–02 — no new API routes. One limitation of the current
  `PhaseExecutor` interface: `execute` only accepts an injectable
  `AiProvider`, not a research provider, so Phase 03's registry entry
  always resolves its own `getResearchProvider()` internally. Tests
  that exercise Phase 03 through the real registry (as opposed to
  calling `runExistingSolutionsPhase` directly, which does accept an
  injectable research provider) mock `@/lib/research`'s
  `getResearchProvider` export instead.

### 2d. Phase 04 — Gap Intelligence

The first phase driven by a single agent again (like Phase 01), but the
first whose composer does substantial enforcement on top of that one
call — because it's synthesizing across *three* upstream phases at
once and the cost of a hallucinated gap is high. No research calls: it
reasons entirely over Phases 01–03's already-collected evidence, so no
`research` usage or `ResearchProvider` involvement at all — only the
generic `ai` charge the phase engine already applies around one call.

- **`src/lib/agents/gap-agent/`** — one Gemini call, grounded in the
  approved Problem Intelligence, Stakeholder & Pain, and Existing
  Solution outputs. Its central instruction is the phase's core rule:
  **absence of evidence is not evidence of absence** — a source stating
  "Product X provides traffic monitoring" does not prove Product X lacks
  prediction; the honest label for the unaddressed capability is
  `UNKNOWN`, not a gap. Every candidate is classified into exactly one
  of four states: `CONFIRMED_GAP`, `CANDIDATE_GAP`, `UNVERIFIED_GAP`, or
  `NO_GAP_ESTABLISHED` — the last one for anything the model initially
  suspected but then found an existing solution already covers, which
  is explicitly *not* a weak gap, it's not a gap at all. An empty
  `gapCandidates` list — "no meaningful gap" — is a fully valid,
  unpenalized result, the same way Phase 03 treats zero solutions.
  `gapEvidenceClaimSchema` extends the evidence-tagging pattern with
  `sourceIds` (plural) and its own `confidence`, richer than the shared
  `EvidenceClaim`, and rejects at the schema level (`.superRefine`) any
  claim marked `VERIFIED` with zero cited sources. Priority scoring
  reuses the existing `Score` type unchanged (`basis: "ai_estimate"` is
  already exactly the "model estimate, not a measurement" label the
  spec asked for) rather than inventing new vocabulary.
- **`src/lib/phases/gap-intelligence/`** — the composer, which does
  everything Zod alone can't:
  - Validates every stakeholder/pain/solution/source id the agent
    cited against what Phases 01-03 actually produced — an
    unresolvable reference is rejected as `invalid_output`, same
    discipline as Phase 02/03.
  - False-gap prevention beyond the prompt: a `CONFIRMED_GAP` whose
    core claim (`missingCapability`) is only an `ASSUMPTION`, or which
    cites zero sources, is rejected outright — "evidence strongly
    indicates" cannot rest on an assumption alone, and this is checked
    in code, not just requested of the model.
  - Derives `confirmedGaps` / `candidateGaps` / `unverifiedGaps` /
    `noGapFindings` (arrays of gap ids) by filtering the one
    `gapCandidates` list on `gapState`, rather than asking the model to
    repeat the same data across four arrays.
  - Computes `evidenceSummary`'s `totalSourcesReferenced` and
    `verifiedClaimsCount` from the actual gap/claim/coverage data —
    the model only supplies the qualitative `narrative`, continuing
    Phase 03's "no fake numbers" pattern.
- **Coverage matrix** (`coverageMatrixEntrySchema`): a sparse list of
  solution × stakeholder × pain × capability assessments
  (`COVERED`/`PARTIALLY_COVERED`/`NOT_ESTABLISHED`/`UNKNOWN`) — the
  model only reports combinations it can reason about, never an
  exhaustive cartesian product padded with guesses, and
  `NOT_ESTABLISHED` is deliberately kept distinct from "not covered."
- **Research follow-up, scoped down**: the spec allows Phase 04 to
  flag questions Phase 03's research didn't answer, with an explicit
  warning not to turn this into an uncontrolled research loop. This
  implementation takes the simpler, explicitly-permitted path: gap
  candidates carry `validationQuestions` as data for future validation
  (a later phase or a human), and Phase 04 performs **no follow-up
  Tavily calls of its own** — no new research-usage accounting was
  needed here at all.
- **Dependency on Phase 01, 02, AND 03**: enforced entirely by the
  existing, unmodified `PrismOrchestrator.canEnterPhase`. One nuance
  worth documenting because it surprised a first draft of this phase's
  own tests: `existing_solutions` (Phase 03) has `requiresApproval:
  false` in the phase catalog, so the orchestrator only requires it to
  have *run* (not be `not_started` or `failed`) before Phase 04 may
  start — it does not need to be explicitly `approved`, unlike Phase 01
  and Phase 02. That's the existing, correct gating behavior for a
  non-approval-gated upstream phase, not a Phase 04-specific rule.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–03. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

Phases 05–10 extend this the same way: add an entry to the agent
registry, and where a phase needs more than one agent, have that
phase's `execute` internally call each and merge their output — the
phase engine only ever sees one `AiResult`.

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

Phase 03 (§2c) is this abstraction's first real caller — its Research
Agent calls `getResearchProvider()` and consumes `ResearchSource`/
`ResearchResult` exactly as defined here, with no phase-specific
wrapper around the provider itself (only a `.extend()`'d schema for the
two fields — `sourceLocalId`, the query that produced it — the phase
needs on top).

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
  screens, dossier view, stakeholder/pain relationship graph, existing-
  solution comparison view, gap coverage matrix view) — Phases 01–04
  exist as tested API + service layer only; see §2a/§2b/§2c/§2d. The
  stakeholder/pain data model is built to support a future network-graph
  view (`painPointIds` on each stakeholder), but no visual graph exists.
- Phases 05–10's agents, schemas, and prompts (the registry and engine
  they plug into are done — see §2a/§2b/§2c/§2d)
- Populating the normalized `stakeholders` / `pain_points` /
  `research_sources` tables from Phase 02/03 output (currently
  jsonb-only — see §2b/§2c). Phase 04 has no normalized-table
  counterpart in the existing schema at all — its output lives in
  `analysis_phases.output_data` only, by design (see §2d).
- PDF upload handling for the `pdf_upload` input method (the schema and
  `source_file_url` column exist; nothing populates or reads a file yet)
- The voice consultant and cinematic opening experience
- The final Intelligence Dossier renderer
- `serpapi` / `bing` research providers
