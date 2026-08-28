import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

const MODE_INSTRUCTIONS: Record<ProjectMode, string> = {
  HACKATHON:
    "Populate `modeFeasibility.hackathon` and leave pbl/startup/research/zeroDegree null. Evaluate time available, team size, team skills, hardware/software/API/data access, and prototype/demo/deployment scope. This is the mode where telling a team what NOT to build matters most — `buildScope.doNotBuild` should be as considered as `mustBuild`. Only assess the hackathon durations (24_HOUR, 48_HOUR, 1_WEEK) that are actually relevant to the timeline under discussion — do not force all three.",
  PBL: "Populate `modeFeasibility.pbl` and leave hackathon/startup/research/zeroDegree null. Evaluate academic scope, problem definition, methodology, implementation, experimentation, testing, documentation, evaluation, timeline, and team capability. The implementation roadmap should read as a plan suitable for an academic project, not a commercial launch.",
  STARTUP:
    "Populate `modeFeasibility.startup` and leave hackathon/pbl/research/zeroDegree null. This block only needs to capture what's genuinely startup-specific (customer deployment, compliance requirements, operational readiness) — technical, data, cost, scalability, and team feasibility are already covered by the universal sections; apply a startup lens there (unit economics, deployability, security/compliance) rather than repeating them here.",
  RESEARCH:
    "Populate `modeFeasibility.research` and leave hackathon/pbl/startup/zeroDegree null. Evaluate the research question, novelty, methodology, experimental design, reproducibility, and limitations. Data and evaluation feasibility are covered by the universal sections.",
  ZERO_DEGREE:
    "Populate `modeFeasibility.zeroDegree` and leave hackathon/pbl/startup/research null. Evaluate strategic fit, productization potential, reuse potential, community value, research value, future commercialization, and ecosystem fit.",
};

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Feasibility Agent inside PRISM, Phase 07 — Technical + Implementation Feasibility Intelligence. Your job is to answer one question honestly: can this actually be built, deployed, adopted, and scaled — not 'is this a good idea' (Phases 01-06 already covered that), but 'is this buildable'. A project can have high impact, a strong market, and real innovation and still be technically infeasible, too expensive, too data-dependent, too slow to build, too complex for the team, or too risky for its deployment environment. You must say so when that's what the evidence shows.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    `The feasibility analysis is mode-aware. Project mode: ${MODE_LABELS[mode]}. ${MODE_INSTRUCTIONS[mode]} When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
    "",
    "TECHNICAL FEASIBILITY: assess all thirteen dimensions (architecture, technology maturity, dependencies, APIs, hardware, software, data, infrastructure, integration, security, performance, reliability, maintenance) as FEASIBLE, CONDITIONALLY_FEASIBLE, DIFFICULT, INFEASIBLE, or UNKNOWN — UNKNOWN is honest when a dimension genuinely isn't answerable from the evidence, and FEASIBLE is honest when a dimension is trivially not a concern (e.g. 'hardware' for a pure software product).",
    "",
    "DATA FEASIBILITY: never assume a required dataset exists. If a dataset is mentioned anywhere in the upstream analysis, verify it through the actual evidence you were given where possible; otherwise classify its availability as UNKNOWN rather than assuming AVAILABLE.",
    "",
    "AI FEASIBILITY: only populate `aiFeasibility` if the opportunity genuinely proposes using AI/ML — set it to null otherwise. Do not assume an LLM is necessary just because the domain sounds modern; classify honestly as AI_REQUIRED, AI_FEASIBLE, AI_RISKY, or AI_NOT_NEEDED, and say so explicitly when a deterministic approach would work better.",
    "",
    "HARDWARE FEASIBILITY: only populate `hardwareFeasibility` if hardware is genuinely involved — set it to null otherwise. Never invent a component price; `cost` must be UNKNOWN when no real pricing evidence exists.",
    "",
    "TEAM FEASIBILITY: only list the skill areas genuinely implicated by this opportunity. `teamHasCapability` must be UNKNOWN unless real team-capability evidence exists — never invent team skills or assume a capable team.",
    "",
    "TIME AND COST: every duration and cost figure is a `marketNumber` — MODEL_ESTIMATE with its calculation shown (inputs, formula, assumptions) when you estimate it, VERIFIED only when a specific cited source states it, UNKNOWN otherwise. Never present an estimate as a verified fact, and never fabricate an exact cost — use a representative figure with the uncertainty spelled out in `reasoning` when a precise number isn't defensible.",
    "",
    "REGULATORY, SAFETY, SECURITY: only mark a regulatory requirement's status VERIFIED when a specific source actually supports it — otherwise UNKNOWN. Never fabricate a regulation, certification, or compliance requirement that isn't grounded in real evidence.",
    "",
    "RISK REGISTER: every risk's likelihood/impact/severity is a qualitative judgment (never a fabricated numeric probability), and `basis` must be `ai_estimate` since these are your own judgment calls, not measured facts.",
    "",
    "OVERALL FEASIBILITY: do not let an average score hide a critical blocker. A project with strong technical feasibility but unavailable required data is CONDITIONALLY_FEASIBLE at best, not FEASIBLE or HIGHLY_FEASIBLE — a single critical dependency being INFEASIBLE, UNAVAILABLE, or otherwise blocking caps the overall result regardless of how well everything else scores. List every genuine critical blocker in `criticalBlockers` — leave it empty only when none actually exist, never invent one to seem thorough.",
    "",
    "FEASIBILITY REALITY CHECK: conclude with one dynamically-explained signal — READY_TO_BUILD, BUILDABLE_WITH_CONSTRAINTS, HIGH_RISK_BUILD, NOT_FEASIBLE_NOW, or INSUFFICIENT_EVIDENCE — grounded in what you actually found, never boilerplate. PRISM must be comfortable concluding a technically impressive project on an impossible timeline is NOT_FEASIBLE_NOW or HIGH_RISK_BUILD — a good idea with the wrong scope is not a positive feasibility result.",
    "",
    "IMPLEMENTATION ROADMAP: adapt the phases to the actual project and mode — do not assume every project needs the same six phases (preparation/foundation/core prototype/integration/testing/deployment); skip or merge phases that genuinely don't apply.",
    "",
    "Use the existing evidence vocabulary throughout: VERIFIED, INFERENCE, ASSUMPTION, RECOMMENDATION, UNKNOWN. Never fabricate a VERIFIED claim — any sourced factual claim must cite a real source id from the evidence list you were given.",
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  leadingOpportunity: Opportunity | null,
  stakeholderPain: StakeholderPainAnalysis,
  gapIntelligence: GapIntelligenceAnalysis,
  existingSolutions: ExistingSolutionsAnalysis,
  marketInvestment: MarketInvestmentAnalysis,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name} (${s.category}; roles: ${s.roles.join(", ")})`)
    .join("\n");

  const existingSolutionLines =
    existingSolutions.solutions.length > 0
      ? existingSolutions.solutions
          .map((s) => `- ${s.name}: ${s.technology.join(", ") || "technology unknown"}`)
          .join("\n")
      : "(Phase 03 identified no existing solutions.)";

  const sourceLines =
    marketInvestment.marketEvidence.sources.length > 0
      ? marketInvestment.marketEvidence.sources
          .map((s) => `- [${s.sourceLocalId}] "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`)
          .join("\n")
      : "(No evidence sources are available for this run.)";

  const opportunitySection = leadingOpportunity
    ? [
        `Leading opportunity: ${leadingOpportunity.title} (${leadingOpportunity.opportunityState}, confidence: ${leadingOpportunity.confidence})`,
        `Description: ${leadingOpportunity.description}`,
        `Innovation directions: ${leadingOpportunity.innovationDirections.map((d) => d.directionType).join(", ") || "(none)"}`,
      ].join("\n")
    : "Phase 05 did not identify a meaningful opportunity, and Phase 06 analyzed on that basis. Assess feasibility of the problem space honestly given that absence — expect UNKNOWN/INSUFFICIENT_EVIDENCE where nothing concrete exists to evaluate.";

  const gapLines =
    gapIntelligence.gapCandidates.length > 0
      ? gapIntelligence.gapCandidates
          .map((g) => `- [${g.gapId}] (${g.gapState}) ${g.title}`)
          .join("\n")
      : "(Phase 04 identified no gap candidates.)";

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
    "Existing solutions and their known technology (Phase 03):",
    existingSolutionLines,
    "",
    `Market & investment summary (Phase 06): ${marketInvestment.marketSummary}`,
    `Market reality check: ${marketInvestment.marketRealityCheck.signal} — ${marketInvestment.marketRealityCheck.explanation}`,
    `Investment reality check: ${marketInvestment.investmentRealityCheck.signal} — ${marketInvestment.investmentRealityCheck.explanation}`,
    `Capital intensity: ${marketInvestment.investmentAnalysis.capitalIntensity} — ${marketInvestment.investmentAnalysis.capitalIntensityReasoning}`,
    "",
    "Evidence sources available (reused from Phase 03 and Phase 06's own market research):",
    sourceLines,
    "",
    "Produce the full feasibility analysis for the leading opportunity, citing sourceLocalIds from the list above wherever you mark something VERIFIED.",
  ].join("\n");
}
