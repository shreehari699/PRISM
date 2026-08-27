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
  each mapped to the phase it belongs to. Fourteen of these are
  implemented (see §2a through §2j) — the Jury Agent is the deliberate
  exception: Phase 09's Validation Agent already runs the full red-team
  and five-perspective jury review, so Phase 10 reuses that output
  directly instead of running a second jury simulation (see §2j).
  Phase 06's Market Agent internally depends on a Market Research Agent
  component (`src/lib/agents/market-research-agent/`) the same way
  Phase 03's named Research Agent internally splits into a
  question-generator and an executor — an implementation detail under
  the one named `market_agent` slot, not a 16th roster entry.
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

All ten PRISM phases are implemented on this foundation — nothing
remains planned at the orchestration layer.

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

### 2e. Phase 05 — Opportunity & Innovation Intelligence

Two agents, run in sequence within one composer call, the same
"phase engine sees one `AiResult`" pattern as Phase 02. No new
orchestration system, AI abstraction, or research provider — this
phase reasons entirely over Phases 01–04's already-collected evidence
(no Tavily calls of its own), and both agent calls are charged as the
single generic `ai` unit the phase engine already applies per run
(`combineUsage`, same as Phase 02).

- **`src/lib/agents/opportunity-agent/`** — the first call. Given the
  approved Problem, Stakeholder & Pain, Existing Solution, and Gap
  analyses, it identifies which gaps represent a genuinely meaningful
  opportunity — explicitly not "generate ideas," not "add AI
  everywhere." Every draft opportunity is classified into exactly one
  of `STRONG_OPPORTUNITY` / `PROMISING_OPPORTUNITY` /
  `EXPLORATORY_OPPORTUNITY` / `INSUFFICIENT_EVIDENCE`, and an empty
  `opportunities` list — "no meaningful opportunity here" — is a fully
  valid, unpenalized result, the same discipline Phase 03 applies to
  zero solutions and Phase 04 applies to zero gaps. Each opportunity
  carries a `whyNow` block (technology readiness, market shift, policy
  change, behavior change, infrastructure change, cost reduction, new
  data availability, new regulations, new unmet demand — each
  evidence-tagged, `VERIFIED` only when the upstream evidence actually
  supports it) and an `impact` list that only includes dimensions
  (user/community/industry/government/economic/environmental/social/
  operational) genuinely relevant to that opportunity, never a padded
  full set.
- **`src/lib/agents/innovation-agent/`** — the second call, given the
  first call's draft opportunities as an explicit parameter (the same
  "second agent takes the first agent's output as a param, not through
  `context`" pattern the Pain Analyst uses for the Stakeholder
  Analyst's output). For every opportunity it produces exactly one
  assessment: candidate innovation directions (from an 11-value
  vocabulary — `SOFTWARE`, `HARDWARE`, `AI_ML`, `AUTOMATION`, `DATA`,
  `WORKFLOW`, `SERVICE`, `INFRASTRUCTURE`, `POLICY_PROCESS`,
  `MARKETPLACE`, `HYBRID` — only the categories that genuinely fit, an
  empty list when none do), a differentiation claim, `innovationPotential`
  / `feasibilityPotential` scores, a `refinedOpportunityState` (which
  may confirm or downgrade the draft agent's first-pass guess once a
  viable direction has actually been searched for), and per-opportunity
  `validationQuestions` for anything still uncertain.
  - **Mandatory anti-AI-hype rule**: every innovation direction carries
    an `aiJustification` classified `AI_REQUIRED` / `AI_USEFUL` /
    `AI_OPTIONAL` / `AI_NOT_JUSTIFIED`, with required reasoning. This
    is enforced beyond the prompt: the composer rejects as
    `invalid_output` any `AI_ML` direction whose own justification says
    `AI_NOT_JUSTIFIED` — a direct contradiction that would otherwise
    let the model quietly default to "add AI" regardless of its own
    stated reasoning.
  - **Differentiation, without overclaiming**: differentiation is a
    `richEvidenceClaim` (see below), and the composer mechanically
    rejects any claim containing "first," "only," "unique," or "world's
    first" unless its `status` is `VERIFIED` — a hedged "potential" or
    "identified" differentiation is required otherwise. This is a
    pattern match on the model's own claim text, not just a prompt
    instruction.
  - **Opportunity landscape**: every opportunity — including weak ones
    — gets a comparison row across stakeholder value, pain relevance,
    gap strength, differentiation strength, innovation strength,
    feasibility strength, impact strength, and confidence (all
    qualitative `low`/`medium`/`high`). The composer rejects output that
    omits any opportunity from this comparison ("do not hide weaker
    opportunities"), then computes an ordinal `rank` deterministically
    from those qualitative levels — continuing the "no fake numbers"
    discipline: the model supplies honest qualitative judgments, the
    rank number itself is never asked of or estimated by the model.
  - **Opportunity reality check**: one dynamically-generated signal per
    run — `STRONG` / `PROMISING` / `SPECULATIVE` /
    `NO_CLEAR_OPPORTUNITY` / `INSUFFICIENT_EVIDENCE` — with an
    explanation grounded in that run's actual findings, never
    boilerplate.
- **`richEvidenceClaimSchema`** (`src/lib/prism/evidence.ts`) — Phase
  04's `gapEvidenceClaimSchema` (claim/status/`sourceIds`/confidence/
  reasoning, `VERIFIED` requires ≥1 cited source) promoted to a shared
  schema once Phase 05 needed the identical shape, rather than a third
  phase defining its own copy. `gap-agent/schema.ts` now re-exports it
  under its original name — zero breakage for Phase 04's own code or
  tests.
- **`src/lib/phases/opportunity-innovation/`** — the composer. Runs the
  Opportunity Agent, validates every reference it cited (stakeholder,
  pain, gap, source id) against what Phases 01–04 actually produced —
  including rejecting an opportunity grounded in a gap whose state is
  `NO_GAP_ESTABLISHED`, completing the opportunity chain (problem →
  stakeholder → pain → existing solution → gap → unserved need →
  opportunity → innovation direction) as a code-enforced invariant, not
  a prompt request. Only then runs the Innovation Agent against the
  resulting draft opportunities, checks its assessments are exactly
  one-per-opportunity (no missing, no duplicates, no unknown ids), then
  merges each draft opportunity with its assessment into the final
  `opportunitySchema` — replacing the draft's first-pass
  `opportunityState` with the Innovation Agent's `refinedOpportunityState`.
  `overallFinding` (`MEANINGFUL_OPPORTUNITY_FOUND` /
  `NO_MEANINGFUL_OPPORTUNITY`) is computed here, not asked of either
  model: `NO_MEANINGFUL_OPPORTUNITY` when there are no opportunities at
  all, or every one of them was refined down to
  `INSUFFICIENT_EVIDENCE` — concluding "no real opportunity" is treated
  as a legitimate, successful result, never a failure to route around.
- **Opportunity vs. solution, kept separate**: Phase 05 may name
  innovation *directions* (a category and its rationale), but never a
  concrete product architecture — that remains Phase 08's job
  (Solution Consultant), grounded in every prior phase rather than
  invented up front.
- **Dependency on Phase 01, 02, AND 04**: enforced entirely by the
  existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  Phase-05-specific gating logic. As with Phase 04, `existing_solutions`
  (Phase 03) only has to have run, not be explicitly approved, since it
  has `requiresApproval: false` in the phase catalog.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–04. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

### 2f. Phase 06 — Market & Investment Intelligence

Three calls in one composer run — a bounded Market Research Agent, the
Market Agent, then the Investment Agent grounded in the Market Agent's
own validated output — the same "phase engine sees one `AiResult`"
pattern Phase 03 established for its own research-agent +
existing-solution-agent pipeline. No new orchestration system, AI
abstraction, or research provider: the Market Research Agent reuses the
exact same `ResearchProvider` Phase 03 injects, just with its own
market-flavored query categories and a phase-local executor
(`src/lib/agents/market-research-agent/executor.ts`) — duplicated glue
over the one shared abstraction, not a second one.

- **Leading opportunity, not all of them**: the phase catalog's own
  description ("assess market size, competitive landscape, and
  investment considerations for the leading opportunity") settles a
  question the spec text leaves open. The composer selects Phase 05's
  own top-ranked opportunity (from `opportunityLandscape`, walking rank
  1 upward until it finds one whose refined state isn't
  `INSUFFICIENT_EVIDENCE`) — never re-ranking itself. `null` when
  Phase 05 concluded `NO_MEANINGFUL_OPPORTUNITY`, and every agent is
  written to produce an honest, evidence-thin analysis on that basis
  rather than the phase being skipped.
- **`src/lib/agents/market-research-agent/`** — the first call: a
  question generator (10 market-specific categories — MARKET_SIZE,
  MARKET_GROWTH, ADOPTION, INDUSTRY_TRENDS, GOVERNMENT_SPENDING,
  CUSTOMER_BEHAVIOR, TECHNOLOGY_ADOPTION, REGULATORY, DEMAND,
  GEOGRAPHIC) grounded in the leading opportunity specifically, never a
  generic catch-all query — followed by the same bounded Tavily
  execution pattern as Phase 03, checking the `research` usage quota
  first and returning `budgetExhausted: true` (never a hard failure)
  when it's spent. Sourced `sourceLocalId`s are prefixed
  `market-source-` so they can never collide with Phase 03's own
  `source-N` ids once the two lists are combined.
- **Source reuse**: the composer combines Phase 03's existing-solution
  sources with this phase's own newly-researched ones into one list
  before ever calling the Market Agent — Phase 03's sources are never
  re-fetched, only re-cited.
- **`src/lib/prism/market.ts`** — `marketNumberSchema`, the one
  primitive every market figure in this phase is expressed through
  (TAM/SAM/SOM, pricing, unit economics). Its own `.superRefine()` is
  what makes "no fabricated market numbers" an enforced invariant:
  `UNKNOWN` must carry a null value; `VERIFIED` must cite at least one
  source and must NOT carry a calculation (a verified figure was read
  from a source, not derived); `MODEL_ESTIMATE` must show its
  calculation (inputs, formula, assumptions) so the number is always
  reproducible. `illustrativeValuationScenarioSchema` reuses the same
  mechanism but mechanically forbids `VERIFIED` entirely — a valuation
  can only ever be `ILLUSTRATIVE_MODEL_ESTIMATE` or `UNKNOWN`, so PRISM
  can never present an exact company valuation as verified fact.
- **`src/lib/agents/market-agent/`** — the second call. Produces the
  customer model (five evidence-tagged questions — who experiences the
  pain, who uses the solution, who pays, who approves, who benefits —
  plus role assignments from a market-specific 9-role vocabulary: USER,
  CUSTOMER, BUYER, BENEFICIARY, OPERATOR, OWNER, DECISION_MAKER,
  REGULATOR, INFLUENCER, deliberately distinct from Phase 02's own
  problem/pain-lens `StakeholderRole`), market segments (only genuinely
  relevant ones from a 15-category list), the competitive landscape
  (DIRECT/INDIRECT/SUBSTITUTE/INTERNAL_WORKAROUND/EMERGING, built from
  Phase 03's solutions plus new research), market drivers, adoption
  analysis, TAM/SAM/SOM, business models with pricing hypotheses, unit
  economics, a fixed 7-dimension scalability assessment (technical,
  operational, geographic, customer, support, regulatory, data — always
  all seven, the same non-sparse shape as Phase 03's
  `researchCoverageSchema`), the market reality check, and the market
  scores.
  - **Anti-overclaim, mechanically enforced**: `competitiveLandscape.summary`
    is a `richEvidenceClaim`, so a `VERIFIED` "no competitors identified"
    conclusion can only exist if it actually cites supporting research —
    the existing VERIFIED-needs-a-source rule satisfies "don't claim 'no
    competitors' without evidence" for free, no new logic needed. The
    composer additionally rejects any competitor whose
    `marketPositionIfVerified` uses market-leadership language ("market
    leader", "dominant", "largest", …) unless `status` is `VERIFIED` —
    the same pattern-match discipline Phase 05 applies to differentiation
    claims.
  - **TAM/SAM/SOM ordering**: the composer rejects a SAM larger than its
    TAM, or a SOM larger than its SAM, whenever both figures are
    non-null — a cheap, valuable sanity check no prompt instruction can
    guarantee on its own.
- **`src/lib/agents/investment-agent/`** — the third call, given the
  Market Agent's already-validated output as an explicit parameter (the
  same "second agent takes the first agent's output as a param" pattern
  the Pain Analyst uses for the Stakeholder Analyst's output).
  Produces investment analysis (capital intensity as a qualitative band —
  `LOW`/`MODERATE`/`HIGH`/`VERY_HIGH` — never a specific currency figure,
  plus concrete development/infrastructure/team/operational/deployment
  requirements and a funding-stage recommendation), valuation drivers,
  the investment reality check, investment scores, and the final
  `confidenceSummary` and `consultantMessage` for the whole phase — it
  sees both the market and investment picture, so it supersedes the
  Market Agent's own framing, the same "last agent's message wins"
  precedent Phase 02/04/05 already establish.
- **`src/lib/phases/market-investment/`** — the composer. Beyond the
  TAM/SAM/SOM ordering and market-leadership checks above, it walks
  both agents' entire output trees collecting every `sourceIds` array
  found anywhere (`collectCitedSourceIds` — a generic recursive walk
  rather than enumerating each of the dozens of individual claim/number
  fields by hand) and rejects any citation that doesn't resolve to the
  combined Phase 03 + Phase 06 source list. `pricingHypotheses` and
  `evidenceSummary` (verified/model-estimate/unknown counts,
  `totalSourcesReferenced`) are computed here from the pipeline's own
  data, never asked of either model. `marketEvidence.status` is set to
  `PARTIAL_MARKET_EVIDENCE` — never asked of a model — whenever this
  run's own research hit the usage budget or a query failure;
  `validationQuestions` are merged and deduplicated from both agents.
- **Dependency on Phase 01, 02, 04, AND 05**: enforced entirely by the
  existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  Phase-06-specific gating logic. As with Phase 04/05, `existing_solutions`
  (Phase 03) only has to have run, not be explicitly approved.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–05. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

### 2g. Phase 07 — Technical + Implementation Feasibility Intelligence

A single agent, like Phase 01 and Phase 04 — the phase catalog's own
`agents: ["feasibility_agent"]` roster entry — no new Tavily research of
its own. Phase 07 answers "can this actually be built, deployed,
adopted, and scaled", deliberately distinct from every prior phase's
"is this a good idea": a project can have high impact, a strong market,
and real innovation (Phases 01–06 already established that) and still
be technically infeasible, too expensive, too data-dependent, or too
complex for the team — PRISM must be willing to say so.

- **No new research**: unlike Phase 03/06, Phase 07 reasons entirely
  over Phases 01–06's already-collected evidence. This mirrors Phase
  04's precedent exactly (a single named agent, zero new Tavily calls,
  uncertain items become `validationQuestions` for a human or a later
  phase) rather than inventing a second internal research agent the
  phase catalog's roster doesn't call for. Every cited source resolves
  against Phase 06's already-combined evidence list
  (`market_investment.marketEvidence.sources`, itself Phase 03 reused +
  Phase 06 researched) — reusing Phase 03's sources is achieved
  transitively through Phase 06's own persisted output, not a third
  re-fetch.
- **The leading opportunity, reused**: rather than re-deriving "which
  opportunity is this" a third time, Phase 07 imports
  `selectLeadingOpportunity` — exported from Phase 06's own module once
  Phase 07 needed the identical selection — instead of duplicating that
  algorithm.
- **`src/lib/agents/feasibility-agent/`** — mode-aware from the ground
  up: `modeFeasibility` carries one block per project mode (HACKATHON,
  PBL, STARTUP, RESEARCH, ZERO_DEGREE), and only the one matching
  `context.mode` is ever populated, the rest `null` — the composer
  enforces that invariant. Each mode's block captures only what's
  genuinely mode-unique (HACKATHON's access checks and MUST/SHOULD/
  COULD/DO-NOT-BUILD framing including explicit 24-hour/48-hour/1-week
  duration checks; PBL's academic rigor questions; STARTUP's customer-
  deployment/compliance/operational-readiness angle; RESEARCH's novelty/
  reproducibility/experimental-design; ZERO_DEGREE's strategic-fit/
  productization/reuse-potential) — technical, data, cost, team, and
  scalability feasibility are universal sections evaluated once,
  reframed by mode through the prompt rather than duplicated five times.
  - Thirteen technical dimensions and nine software components are each
    a fixed, always-fully-present object (never a sparse array) — the
    same non-sparse shape as Phase 03's `researchCoverageSchema` and
    Phase 06's `scalabilitySchema`.
  - `aiFeasibility`/`hardwareFeasibility` are `null` whenever AI or
    hardware genuinely isn't involved — never forced.
  - Every time/cost figure reuses Phase 06's own `marketNumberSchema`
    unchanged (`src/lib/prism/market.ts`) rather than a third "estimate"
    primitive: `MODEL_ESTIMATE` with its calculation shown, `VERIFIED`
    only with a cited source, `UNKNOWN` otherwise.
  - Every risk in the risk register reuses the existing `Score` module's
    `scoreBasisSchema` (`"ai_estimate"`) for its `basis` field — exactly
    the "MODEL_ESTIMATE" label the spec asks for, no new vocabulary.
  - Team capability is `UNKNOWN` by default and stays that way absent
    real roster evidence — PRISM has no team-roster data to check
    against, so guessing was never an option.
- **`src/lib/phases/technical-feasibility/`** — the composer enforces
  three things beyond what Zod alone can check:
  - **Mode consistency**: `modeFeasibility.mode` must equal
    `context.mode`, and exactly the one matching block is populated —
    any other combination is rejected as `invalid_output`.
  - **Source citations**: every `sourceIds` reference anywhere in the
    output (via the shared `collectCitedSourceIds` walk, promoted to
    `src/lib/prism/evidence.ts` once Phase 07 needed the identical walk
    Phase 06's composer already had) must resolve against Phase 06's
    combined source list.
  - **No hidden blocker**: `overallFeasibility` cannot be
    `HIGHLY_FEASIBLE` or `FEASIBLE` while a critical blocker exists, a
    technical dimension is `INFEASIBLE`, or a required dataset is
    `UNAVAILABLE` — a single critical dependency caps the result
    regardless of how well everything else scores, mechanically
    enforced rather than merely requested of the model (the spec's own
    example: Technical=HIGH, Data=LOW ⇒ Overall can only be
    `CONDITIONALLY_FEASIBLE` at best).
  `criticalBlockersSummary` (`NONE_IDENTIFIED` / `BLOCKERS_IDENTIFIED`)
  and `evidenceSummary`'s numeric counts are computed here from the
  pipeline's own data, continuing the "no fake numbers" split Phase 04's
  gap-intelligence composer establishes between agent-supplied narrative
  and composer-computed numbers.
- **Dependency on Phase 01, 02, 04, AND 05**: enforced entirely by the
  existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  Phase-07-specific gating logic. As with Phase 06, both
  `existing_solutions` (Phase 03) and `market_investment` (Phase 06)
  only have to have run, not be explicitly approved, since both carry
  `requiresApproval: false` in the phase catalog.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–06. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

### 2h. Phase 08 — Solution Consultant & System Design Intelligence

A single agent, like Phase 01, 04, and 07 — the phase catalog's own
`agents: ["solution_consultant"]` roster entry — no new Tavily research
of its own. Phase 08 is where PRISM shifts from ANALYSIS to
RECOMMENDATION: "based on everything discovered, what should this team
actually build?" The recommendation must trace back through the whole
chain (problem → stakeholders → pain → existing solutions → gaps →
opportunity → market → feasibility), never be invented independently of
it.

- **No new research, leading opportunity reused**: exactly Phase 07's
  precedent — Phase 08 reasons entirely over Phases 01–07's already-
  collected evidence and re-imports `selectLeadingOpportunity` from
  Phase 06's module rather than re-deriving it a fourth time.
- **`src/lib/agents/solution-consultant/`** — the `Solution` model
  covers what to build (`solutionType`: SOFTWARE / HARDWARE / AI_SYSTEM
  / AUTOMATION / SERVICE / INFRASTRUCTURE / DATA_PLATFORM /
  MARKETPLACE / WORKFLOW / HYBRID — never forced into one category),
  why it's the right call (`whyThisSolution`, tracing pain → gap →
  opportunity → existing-solution limitations → feasibility → market),
  and why not the alternatives (`alternativesConsidered` — PRISM does
  not generate one solution and simply call it the best).
  - `differentiation` cannot claim "first"/"only"/"unique"/"world's
    first" without a `VERIFIED` `overallClaim` — the same anti-overclaim
    guard Phase 05/06 apply to their own superlative-prone fields,
    reused here.
  - `aiRole.classification` is one of AI_REQUIRED / AI_HIGH_VALUE /
    AI_OPTIONAL / AI_NOT_REQUIRED, each required to say what AI does
    and does **not** do; deterministic engineering logic is never
    quietly replaced by an LLM.
  - `engineeringSafety` keeps AI reasoning separate from deterministic
    engineering calculations for engineering-flavored problems: which
    calculations must stay deterministic, what AI must never decide,
    and whether a qualified professional's review is required — the
    LLM is never the authority on a structural, safety-critical,
    material, load, hydraulic, electrical, or regulated decision.
  - `architecture` (inputs / processing / AI components / deterministic
    components / database / external APIs / hardware / outputs) and
    `dataFlow` (a fixed, always-fully-present seven-stage object —
    INPUT → INGESTION → VALIDATION → PROCESSING → INTELLIGENCE →
    DECISION → OUTPUT, the same non-sparse shape as Phase 07's
    technical-dimension checklist) are structured data, ready for a
    future UI diagram to render — no image generation yet.
  - `featureScope` (MUST_HAVE / SHOULD_HAVE / FUTURE / DO_NOT_BUILD) is
    the single source of truth for feature prioritization; the
    `Solution` model's own `coreFeatures`/`mustHaveFeatures`/
    `futureFeatures` fields are composer-derived projections of it, not
    a second list the model authors from scratch under different names
    — the same "derive, don't ask twice" discipline as Phase 04's
    confirmed/candidate gaps and Phase 06's pricing hypotheses.
  - `implementationPlan` steps and `pocDefinition` reuse Phase 06's
    `marketNumberSchema` for effort estimates (`MODEL_ESTIMATE` with its
    calculation shown, never a bare invented number), and
    `successMetrics` use a deliberately narrower, Phase-08-local
    `TARGET`/`MODEL_ESTIMATE` vocabulary — nothing is measured pre-build,
    so there is no `VERIFIED` option here.
  - `modeSolutionPlan` mirrors Phase 07's mode-aware pattern exactly:
    one block per project mode (HACKATHON's 24-hour build plan and
    demo narrative; PBL's academic objective and methodology; STARTUP's
    product scope and business model; RESEARCH's research question and
    experimental design; ZERO_DEGREE's strategic fit and reuse
    potential), only the one matching `context.mode` populated.
  - `solutionRealityCheck` (RECOMMENDED_TO_BUILD /
    RECOMMENDED_WITH_CONSTRAINTS / RESEARCH_BEFORE_BUILD /
    NOT_RECOMMENDED / INSUFFICIENT_EVIDENCE) is the mode-agnostic verdict
    every other section supports.
- **`src/lib/phases/solution-consultant/`** — the composer enforces what
  Zod alone can't check:
  - **Mode consistency**: the same mechanical check as Phase 07's
    `modeFeasibility` — `modeSolutionPlan.mode` must equal
    `context.mode`, and exactly the matching block is populated.
  - **Manufacture, bidirectionally forbidden**: `solution` is non-null
    if and only if Phase 05 found a leading opportunity — PRISM must
    not invent a solution when there's nothing real to build on, and
    conversely must actually recommend something once there is,
    stronger than any prior phase's one-directional null-coupling.
  - **Chain integrity**: the solution's `opportunityId` must be the
    selected leading opportunity specifically, and `validatedGapId`
    must resolve to a real Phase 04 gap that isn't
    `NO_GAP_ESTABLISHED`.
  - **AI architecture presence**: `aiArchitecture` is present if and
    only if `aiRole.classification` isn't `AI_NOT_REQUIRED`.
  - **Risk provenance**: every risk's `sourceRiskId`, when set, must
    resolve against Phase 07's own risk register — Phase 08 traces
    Phase 07's risks forward rather than re-describing them from
    scratch.
  - **Source citations**: every `sourceIds` reference (via the shared
    `collectCitedSourceIds` walk) must resolve against Phase 06's
    combined source list, exactly as Phase 07 enforces.
  - **No hidden blocker, carried forward**: if Phase 07's overall
    feasibility is `INFEASIBLE`, the solution reality check cannot be
    `RECOMMENDED_TO_BUILD`; every Phase 07 critical blocker must be
    acknowledged by title; if Phase 07's confidence is
    `INSUFFICIENT_EVIDENCE`, the solution's own confidence cannot claim
    `STRONG` — Phase 08 cannot manufacture confidence Phase 07 never
    earned.
  `evidenceSummary`'s numeric counts are computed here
  (`countVerifiedClaims`, promoted to `src/lib/prism/evidence.ts`
  alongside `collectCitedSourceIds` once Phase 08 needed the identical
  count Phase 07's composer already had), continuing the same
  agent-narrative/composer-number split as every prior phase.
- **Dependency on Phase 01, 02, 04, 05, AND 07**: enforced entirely by
  the existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  Phase-08-specific gating logic. As with Phase 07, both
  `existing_solutions` (Phase 03) and `market_investment` (Phase 06)
  only have to have run, not be explicitly approved.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–07. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

### 2i. Phase 09 — Validation, Adversarial Review & Jury Challenge

A single agent, like Phase 01, 04, 07, and 08 — the phase catalog's own
`agents: ["validation_agent"]` roster entry — no new Tavily research of
its own. Phase 08 recommended a solution; Phase 09's only job is to try
to break that recommendation. It does not ask the model "is this a good
solution?" — it constructs an adversarial evaluation from Phases 01–08's
own evidence and challenges the claims, assumptions, dependencies,
architecture, market, feasibility, differentiation, user value, and
implementation, one at a time.

- **No new research, reasons over the full chain**: exactly Phase 07/08's
  precedent — Phase 09 re-validates and reasons entirely over Phases
  01–08's already-collected evidence, the widest input surface of any
  phase so far (all eight prior phases, not just the most recent few).
- **`src/lib/agents/validation-agent/`**:
  - **No fake validation**: `validationClaimSchema.evidenceStatus` is a
    six-way vocabulary — `VERIFIED` / `PARTIALLY_SUPPORTED` (evidence-
    validated, and only either status may cite zero sources: the schema
    itself rejects a `VERIFIED` or `PARTIALLY_SUPPORTED` claim with no
    `sourceIds`), `INFERENCE` / `ASSUMPTION` (a model assessment, not a
    fact), and `UNKNOWN` / `CONTRADICTED` (unvalidated) — deliberately
    wider than the shared `evidenceStatusSchema`, since a validation
    claim is actively testing a prior claim rather than making one.
  - **Assumption register**: every assumption the project depends on,
    each with a category (twelve-way: USER/MARKET/TECHNICAL/DATA/
    BUSINESS/OPERATIONAL/REGULATORY/TEAM/TIME/COST/ADOPTION/OTHER), a
    validation method, a failure impact, and an honest status
    (SUPPORTED/PARTIALLY_SUPPORTED/UNSUPPORTED/UNKNOWN/CONTRADICTED) —
    the single source of truth every other section (critical assumption,
    red team's "most fragile assumption") must reference by real id,
    never invent a second one.
  - **Red team**: actively argues *against* the solution, and every
    point is tagged `EVIDENCE_BACKED` (must cite a real source) or
    `HYPOTHETICAL` (a genuine "what if", never disguised as fact) — the
    same discipline `richEvidenceClaimSchema` applies to `VERIFIED`,
    reused here at the red-team-point level.
  - **Jury**: a fixed, always-fully-present five-key object
    (TECHNICAL_JUDGE/DOMAIN_EXPERT/BUSINESS_JUDGE/IMPACT_JUDGE/
    PRODUCT_JUDGE — the same non-sparse discipline as Phase 07/08's
    checklist-shaped fields), each with a `scoreOrAssessment` that
    reuses the shared `Score` model so "never a bare score" is enforced
    by the type itself. Jury questions are dynamically generated per
    project, each with an honest `answerStatus`
    (STRONG/DEFENSIBLE/WEAK/UNKNOWN) — `UNKNOWN` is a legitimate,
    expected answer, not a failure to manufacture around.
  - **Failure modes and pre-mortem**: every failure mode's
    `likelihood`/`severity` is qualitative with `basis: "ai_estimate"` —
    exactly the "MODEL_ESTIMATE, never a fabricated statistic"
    instruction, reusing `scoreBasisSchema` rather than a new vocabulary
    (the same choice Phase 07's risk register made). The pre-mortem
    assumes the project already failed and works backward to plausible
    causes, each with an early warning signal and a preventive action.
  - **Counter-solution analysis**: compares the recommended solution
    against a simpler solution, the best existing solution, and a
    manual workaround, and its `conclusion` enum genuinely allows
    `SIMPLER_SOLUTION_PREFERRED` or `EXISTING_SOLUTION_SUFFICIENT` —
    the validator is not biased toward justifying Phase 08's pick, which
    is the whole point: this is PRISM's guard against overengineering.
  - **`buildRecommendation`** (BUILD/BUILD_WITH_CHANGES/
    VALIDATE_BEFORE_BUILD/DO_NOT_BUILD) is the agent's own honest
    qualitative call — distinct from, and never authoritative over, the
    composer's deterministic `finalValidationDecision` below.
- **`src/lib/phases/poc-validation/`** — the composer enforces what Zod
  alone can't check, and then runs a decision engine the model cannot
  override:
  - **Assumption cross-references**: `criticalAssumption.assumptionId`
    and (when set) `redTeamReview.mostFragileAssumptionId` must resolve
    to a real entry in the agent's own `assumptionRegister` — never a
    newly invented "most dangerous" assumption.
  - **Coherence with Phase 08**: if Phase 08 recommended no solution,
    `buildRecommendation` must be `DO_NOT_BUILD`; `pocValidation.status`
    must be `NO_POC_DEFINED` if and only if Phase 08's own `pocDefinition`
    is actually `null`; an empty Phase 08 `successMetrics` list can
    never be reviewed as well-defined, measurable, relevant, or
    realistic.
  - **Confidence honesty**: `overallConfidence` cannot be `HIGH` while
    any validation claim is `CONTRADICTED` or the critical assumption
    itself is `UNSUPPORTED`/`CONTRADICTED` — PRISM cannot claim high
    confidence in a project it just found a hole in.
  - **Source citations**: every `sourceIds` reference resolves against
    Phase 06's combined evidence list, exactly as Phase 07/08 enforce.
  - **Decision engine** (`finalValidationDecision`: VALIDATED_TO_PROCEED/
    PROCEED_WITH_CHANGES/VALIDATE_BEFORE_BUILD/DO_NOT_BUILD/
    INSUFFICIENT_EVIDENCE) is computed here, never taken from the
    model's `buildRecommendation` unmodified:
    1. No Phase 08 solution → `DO_NOT_BUILD` if Phase 08's own reality
       check was `NOT_RECOMMENDED`, otherwise `INSUFFICIENT_EVIDENCE`.
    2. Phase 07 overall feasibility `INFEASIBLE` → `DO_NOT_BUILD`.
    3. Evidence `CONTRADICTED` on the core problem or its pain →
       `DO_NOT_BUILD`.
    4. Otherwise, a numeric floor (0=VALIDATED_TO_PROCEED best,
       3=DO_NOT_BUILD worst) is raised by: an unsupported/contradicted
       critical assumption (floor ≥ VALIDATE_BEFORE_BUILD), any
       unresolved Phase 07 critical blocker (floor ≥
       PROCEED_WITH_CHANGES — can never be VALIDATED_TO_PROCEED), and a
       feasible-but-not-HIGH-confidence combination (floor raised further
       the weaker the confidence). The final decision is the *worse* of
       this floor and the agent's own `buildRecommendation` — the model
       can independently propose something more pessimistic than the
       floor requires (PRISM must be comfortable concluding "this is a
       bad idea"), but it can never propose something better than the
       floor allows.
  `evidenceSummary`'s numeric counts (including a new
  `contradictedClaimsCount`) are computed here from the validation
  claims themselves, continuing the same agent-narrative/composer-number
  split as every prior phase.
- **Dependency on Phase 01, 02, 04, 05, 07, AND 08**: enforced entirely
  by the existing, unmodified `PrismOrchestrator.canEnterPhase` — no
  Phase-09-specific gating logic. As with Phase 07/08, both
  `existing_solutions` (Phase 03) and `market_investment` (Phase 06)
  only have to have run, not be explicitly approved.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–08. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes.

### 2j. Phase 10 — Final Intelligence Dossier & Decision Synthesis

A single agent — the Report Generator, per the phase catalog's own
`agents: ["jury_agent", "report_generator"]` roster, of which only
`report_generator` is actually invoked (see the Jury Agent note in §2
above) — no new Tavily research of its own. This is the last phase:
PRISM has investigated the problem through nine intelligence layers,
and Phase 10's only job is to synthesize what was already found into
one authoritative dossier. It must not simply concatenate the previous
phases' JSON, and it must not introduce a single new factual claim.

- **The model narrates and selects; the composer assembles the facts.**
  This is the load-bearing design decision of the whole phase.
  `src/lib/agents/report-generator/` supplies only narrative synthesis
  (the executive summary, section-by-section prose) and, where a
  section needs one, a *selection* of a real upstream id — the most
  important gap, which pains/solutions to feature, which of Phase 09's
  red-team points and jury questions are the hardest. It never
  re-authors a stakeholder list, a market number, a feasibility
  dimension, or the jury panel itself — `src/lib/phases/intelligence-dossier/`
  copies or filters every one of those directly from Phases 01–09's own
  structured output. This is what makes "no hallucinated summary" true
  by construction rather than by prompt request alone.
  - Stakeholder tiers and roles (`primaryStakeholders`/`users`/`buyers`/
    `beneficiaries`/`decisionMakers`, etc.) are filtered straight from
    Phase 02's real `category`/`roles` fields — "do not invent
    stakeholder roles" enforced mechanically, not just requested.
  - Every model-selected id (`mostImportantGapId`, `importantPainLocalIds`,
    `importantSolutionLocalIds`, the red-team selection, `topJuryQuestionIds`,
    and every `decisionTrace` stage's `criticalEvidence`) is resolved
    against the real Phase 01–09 output the composer holds and rejected
    as `invalid_output` if it doesn't exist — the same "select, don't
    invent" discipline Phase 08/09 already established for their own
    critical-assumption and mode-plan selections.
  - TAM/SAM/SOM and every other market figure are Phase 06's own
    `marketNumber` objects, copied unchanged — "do not manufacture
    market numbers" is structurally impossible to violate here, since
    the dossier never lets the model touch a number at all.
- **Jury Agent superseded, not duplicated**: Phase 09's Validation
  Agent already ran the full red-team critique and five-perspective
  jury review. Re-running a second jury simulation here would be
  exactly the "duplicate previous phase logic" this phase is forbidden
  from doing, so `jurySummary` reuses Phase 09's own jury panel and
  `redTeamSummary`/`topJuryQuestions` resolve the model's selections
  against Phase 09's real points and questions.
- **Deterministic final decision** (`finalVerdict.decision`: BUILD /
  BUILD_WITH_CHANGES / VALIDATE_BEFORE_BUILD / RESEARCH_BEFORE_BUILD /
  DO_NOT_BUILD / INSUFFICIENT_EVIDENCE) — computed by the composer,
  never taken from the model's own `buildRecommendation` unmodified:
  1. No Phase 08 solution → DO_NOT_BUILD if Phase 08's own reality
     check was NOT_RECOMMENDED, otherwise INSUFFICIENT_EVIDENCE.
  2. Phase 07 overall feasibility INFEASIBLE → DO_NOT_BUILD (an
     explicit, redundant re-assertion of Phase 09's own identical rule
     — defense in depth, since the spec calls this case out by name).
  3. Phase 09's own `finalValidationDecision` is INSUFFICIENT_EVIDENCE,
     or the model's own `buildRecommendation` is INSUFFICIENT_EVIDENCE
     → INSUFFICIENT_EVIDENCE.
  4. Otherwise, Phase 09's decision and the model's own recommendation
     are each placed on the same four-step ladder (BUILD ⇒
     BUILD_WITH_CHANGES ⇒ VALIDATE_BEFORE_BUILD/RESEARCH_BEFORE_BUILD ⇒
     DO_NOT_BUILD) and the *worse* of the two wins — the model can
     independently be more pessimistic than Phase 09's own decision
     (PRISM must be comfortable concluding "this is a bad idea"), but
     can never be more optimistic than what Phase 09 already earned.
     `RESEARCH_BEFORE_BUILD` is the same severity as
     `VALIDATE_BEFORE_BUILD`, surfaced under that name specifically
     when `context.mode` is RESEARCH.
- **Contradiction safeguards** (on top of each phase's own composer,
  defense in depth): a recommended solution grounded in a Phase 04 gap
  that is `NO_GAP_ESTABLISHED` is rejected; an `AI_NOT_REQUIRED`
  solution carrying a non-null `aiArchitecture` is rejected; at most
  five of the twenty sections may be marked `CRITICAL` (rejecting an
  agent that arbitrarily calls everything critical); `overallConfidence`
  cannot stay `HIGH` once a Phase 09 validation claim is `CONTRADICTED`
  or the model's own recommendation is `INSUFFICIENT_EVIDENCE`.
- **Evidence summary, computed from structured data, not model text**:
  `verifiedClaims` sums each prior phase's own already-computed
  verified-count fields (never re-derived by a blind tree walk, which
  would false-positive against unrelated status enums like
  `deploymentStatus` or `scalabilityLevel` that happen to share literal
  values such as `"UNKNOWN"`); `inferences`/`assumptions`/`unknowns`/
  `contradictions` are scoped to Phase 09's own adversarial
  `validationClaims` and assumption register — the one place in the
  pipeline with a reliably-typed, six-way evidence vocabulary;
  `sourcesUsed` is the real intersection of every cited `sourceIds`
  entry (via the shared `collectCitedSourceIds` walk) against Phase 06's
  actual source list. `overallConfidence` is Phase 09's own
  `confidenceSummary.overallConfidence` — the most rigorous
  evidence-quality pass in the pipeline — with one honesty floor
  applied, never a model-confidence average.
- **Dependency on Phase 01, 02, 04, 05, 07, 08, AND 09**: enforced
  entirely by the existing, unmodified `PrismOrchestrator.canEnterPhase`
  — no Phase-10-specific gating logic. As with every prior phase, both
  `existing_solutions` (Phase 03) and `market_investment` (Phase 06)
  only have to have run, not be explicitly approved.
- **Persistence**: `analysis_phases.output_data` (jsonb), same pattern
  as Phases 01–09. No new tables.
- **Registered** in `src/lib/phases/registry.ts` exactly like the prior
  phases — no new API routes, no route changes. `intelligence_dossier`
  is the last phase in the catalog (order 10); there is no Phase 11.

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
needs on top). Phase 06 (§2f) is the second caller, calling the exact
same `getResearchProvider()` factory through its own Market Research
Agent — same abstraction, same `.extend()` pattern, just its own
market-flavored query-category enum.

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
  screens, the final dossier view itself, stakeholder/pain relationship
  graph, existing-solution comparison view, gap coverage matrix view,
  opportunity landscape/ranking view, market/TAM-SAM-SOM/investment
  view, feasibility/risk-register/roadmap view, solution
  architecture/data-flow diagram view, validation/red-team/jury-review
  view) — all ten phases exist as a tested API + service layer only;
  see §2a through §2j. The stakeholder/pain data model is built to
  support a future network-graph view (`painPointIds` on each
  stakeholder), but no visual graph exists. Phase 08's `architecture`
  and `dataFlow` fields, and Phase 10's `decisionTrace` and
  `sectionManifest`, are likewise structured data waiting on future
  diagram/report renderers (web report, PDF, presentation, summary
  card — see §2j), not images or documents generated yet.
- Populating the normalized `stakeholders` / `pain_points` /
  `research_sources` tables from Phase 02/03 output (currently
  jsonb-only — see §2b/§2c). Phases 04 through 10 have no
  normalized-table counterpart in the existing schema at all — their
  output lives in `analysis_phases.output_data` only, by design (see
  §2d through §2j).
- PDF upload handling for the `pdf_upload` input method (the schema and
  `source_file_url` column exist; nothing populates or reads a file yet)
- The voice consultant and cinematic opening experience
- The final Intelligence Dossier renderer
- `serpapi` / `bing` research providers
