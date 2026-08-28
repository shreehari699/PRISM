import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

const MODE_INSTRUCTIONS: Record<ProjectMode, string> = {
  HACKATHON:
    "Populate `modeSolutionPlan.hackathon` and leave pbl/startup/research/zeroDegree null. Produce a concrete 24-hour build plan, a demo flow, MUST_BUILD/SHOULD_BUILD/DO_NOT_BUILD lists, a demo narrative, and a judge-facing value proposition. Never recommend production-grade complexity that can't actually be demonstrated in the time available.",
  PBL: "Populate `modeSolutionPlan.pbl` and leave hackathon/startup/research/zeroDegree null. Produce an academic objective, methodology, implementation approach, experimentation plan, testing plan, documentation plan, evaluation metrics, and a presentation structure.",
  STARTUP:
    "Populate `modeSolutionPlan.startup` and leave hackathon/pbl/research/zeroDegree null. Produce product scope, customer value, business model, deployment approach, scaling approach, security posture, operations plan, and a roadmap summary.",
  RESEARCH:
    "Populate `modeSolutionPlan.research` and leave hackathon/pbl/startup/zeroDegree null. Produce a research question, a hypothesis only where one genuinely applies (null otherwise), methodology, experimental design, evaluation approach, limitations, and future research directions.",
  ZERO_DEGREE:
    "Populate `modeSolutionPlan.zeroDegree` and leave hackathon/pbl/startup/research null. Evaluate strategic fit, community value, productization potential, reusability, team capability, future commercialization, and research potential.",
};

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Solution Consultant inside PRISM, Phase 08 — Solution Consultant & System Design Intelligence. This is the phase where PRISM stops analyzing and starts recommending. Answer one question: based on everything discovered in Phases 01-07, what should this team actually build? The recommendation must originate from the actual chain — problem, stakeholders, pain, existing solutions, gaps, opportunity, market, feasibility — never a solution invented independently of that evidence.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "If Phase 05 identified no meaningful opportunity, set `solution` to null and every dependent field (whyThisSolution, featureScope, dataFlow, pocDefinition) to null too — do not manufacture a solution to fill the slot. Your `solutionRealityCheck.status` in that case must be NOT_RECOMMENDED or INSUFFICIENT_EVIDENCE.",
    "",
    "The solution you propose must address the leading opportunity specifically — its `opportunityId` must be that exact opportunity's id, and `validatedGapId` must be a real Phase 04 gap id that opportunity is actually grounded in.",
    "",
    "WHY THIS SOLUTION: explicitly reference the pain, the gap, the opportunity, what existing solutions fail to do, the feasibility picture, and the market picture — this is not a formality, it's the actual justification chain.",
    "",
    "WHY NOT THE ALTERNATIVES: list real alternative solutions you considered and rejected, with genuine tradeoffs — never present your one recommendation as though it were inevitable with no real alternative ever considered.",
    "",
    "DIFFERENTIATION: separate what's genuinely different, what's incremental, what's defensible, and what's merely a feature. Never claim 'first', 'only', 'world's first', or 'unique' unless your `overallClaim`'s status is VERIFIED by real evidence — otherwise phrase it as a potential or identified differentiation.",
    "",
    "AI ROLE: classify as AI_REQUIRED, AI_HIGH_VALUE, AI_OPTIONAL, or AI_NOT_REQUIRED, and explain what AI does and does NOT do. Do not replace a deterministic calculation with an LLM just because AI is available — if deterministic engineering logic is preferable, say so plainly. Only populate `aiArchitecture` when AI genuinely plays a role (leave it null for AI_NOT_REQUIRED).",
    "",
    "ENGINEERING SAFETY: if this problem is engineering-related, populate `engineeringSafety` and explicitly separate AI reasoning from deterministic engineering calculations. The LLM must never be treated as the authority for structural, safety-critical, material, load, hydraulic, electrical, or other regulated engineering decisions — recommend a deterministic solver, the applicable engineering standard, and human/qualified-professional verification wherever relevant. Leave `engineeringSafety` null when the problem genuinely isn't engineering-related.",
    "",
    "SYSTEM ARCHITECTURE AND DATA FLOW: represent the architecture as structured components with explicit dependencies (so a future UI can render a diagram, which you are not generating now) and the data flow across all seven stages (input, ingestion, validation, processing, intelligence, decision, output) with a real component/responsibility/input/output/dependency/risk for each.",
    "",
    "CORE FEATURES: prioritize the smallest set that delivers the validated value — never a giant feature list. Use `featureScope` for the full MUST_HAVE/SHOULD_HAVE/FUTURE/DO_NOT_BUILD breakdown.",
    "",
    "TECHNOLOGY STACK: recommend technology based on requirements, feasibility, cost, team capability, deployment, and scalability — never merely because it's fashionable. Give each choice's alternative and tradeoff honestly.",
    "",
    "HUMAN-IN-THE-LOOP: identify where human approval is genuinely required (engineering, government, medical, financial, safety, deployment) — never assume AI can replace a domain professional.",
    "",
    "IMPLEMENTATION ROADMAP AND POC: every step's `estimatedEffort` is a `marketNumber` — MODEL_ESTIMATE with its calculation shown, never a verified duration. The POC must prove the core problem is addressed, not that the entire production system exists — define its objective, scope, input, process, output, and both success and failure criteria.",
    "",
    "SUCCESS METRICS: label every target value TARGET (a stated goal) or MODEL_ESTIMATE (a modeled prediction) — never invent a target value without one of those labels, and never VERIFIED, since nothing has been measured yet for a system that doesn't exist.",
    "",
    "RISK: reuse Phase 07's risk register where a risk carries forward (cite its real riskId as `sourceRiskId`) — never invent a contradictory risk. Add new solution-specific risks only where genuinely new ones exist.",
    "",
    "DECISION LOGIC — this is mandatory: if Phase 07's overall feasibility is INFEASIBLE, your `solutionRealityCheck.status` cannot be RECOMMENDED_TO_BUILD. If Phase 07 identified any critical blockers, list every one of their titles in `acknowledgedCriticalBlockers` — never drop one silently. If Phase 07's confidence is INSUFFICIENT_EVIDENCE, your own `confidenceSummary.overallConfidence` must not claim STRONG — communicate the uncertainty honestly instead.",
    "",
    "CONSULTANT VOICE: your `consultantMessage` should read like an experienced, confident, honest, slightly witty, engineering-aware consultant talking to the team — not a boilerplate report. Generate it fresh from what you actually found this run.",
    "",
    `The feasibility and solution analysis are mode-aware. Project mode: ${MODE_LABELS[mode]}. ${MODE_INSTRUCTIONS[mode]} When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
    "",
    "Use the existing evidence vocabulary throughout: VERIFIED, INFERENCE, ASSUMPTION, RECOMMENDATION, UNKNOWN. Recommendations don't require source citations; factual claims do — and any sourced claim must cite a real source id from the evidence list you were given, never an invented one.",
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  leadingOpportunity: Opportunity | null,
  stakeholderPain: StakeholderPainAnalysis,
  gapIntelligence: GapIntelligenceAnalysis,
  marketInvestment: MarketInvestmentAnalysis,
  technicalFeasibility: TechnicalFeasibilityAnalysis,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name} (${s.category}; roles: ${s.roles.join(", ")})`)
    .join("\n");

  const gapLines =
    gapIntelligence.gapCandidates.length > 0
      ? gapIntelligence.gapCandidates
          .map((g) => `- [${g.gapId}] (${g.gapState}) ${g.title}: ${g.description}`)
          .join("\n")
      : "(Phase 04 identified no gap candidates.)";

  const sourceLines =
    marketInvestment.marketEvidence.sources.length > 0
      ? marketInvestment.marketEvidence.sources
          .map((s) => `- [${s.sourceLocalId}] "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`)
          .join("\n")
      : "(No evidence sources are available for this run.)";

  const criticalBlockerLines =
    technicalFeasibility.criticalBlockers.length > 0
      ? technicalFeasibility.criticalBlockers
          .map((b) => `- ${b.title} (${b.category}): ${b.description}`)
          .join("\n")
      : "(Phase 07 identified no critical blockers.)";

  const riskLines =
    technicalFeasibility.riskRegister.length > 0
      ? technicalFeasibility.riskRegister
          .map((r) => `- [${r.riskId}] (${r.category}, ${r.severity} severity) ${r.title}`)
          .join("\n")
      : "(Phase 07's risk register is empty.)";

  const opportunitySection = leadingOpportunity
    ? [
        `Leading opportunity: [${leadingOpportunity.opportunityId}] ${leadingOpportunity.title} (${leadingOpportunity.opportunityState})`,
        `Description: ${leadingOpportunity.description}`,
        `Related gaps: ${leadingOpportunity.relatedGaps.join(", ") || "(none)"}`,
        `Differentiation already identified: ${leadingOpportunity.differentiation.claim}`,
      ].join("\n")
    : "Phase 05 did not identify a meaningful opportunity. Set solution to null and explain why in solutionRealityCheck — do not manufacture a solution.";

  return [
    `Problem: ${problemStatement}`,
    "",
    opportunitySection,
    "",
    "Stakeholders (Phase 02):",
    stakeholderLines,
    "",
    "Gaps (Phase 04):",
    gapLines,
    "",
    `Market summary (Phase 06): ${marketInvestment.marketSummary}`,
    `Market reality check: ${marketInvestment.marketRealityCheck.signal} — ${marketInvestment.marketRealityCheck.explanation}`,
    "",
    `Overall feasibility (Phase 07): ${technicalFeasibility.overallFeasibility.status} — ${technicalFeasibility.overallFeasibility.explanation}`,
    `Feasibility reality check: ${technicalFeasibility.feasibilityRealityCheck.signal} — ${technicalFeasibility.feasibilityRealityCheck.explanation}`,
    `Critical blockers (Phase 07):`,
    criticalBlockerLines,
    `Risk register (Phase 07):`,
    riskLines,
    "",
    "Evidence sources available (reused from Phase 03 and Phase 06's own market research):",
    sourceLines,
    "",
    "Produce the full solution recommendation, citing sourceLocalIds from the list above wherever you mark something VERIFIED.",
  ].join("\n");
}
