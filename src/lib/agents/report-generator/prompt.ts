import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import { selectLeadingOpportunity } from "@/lib/phases/market-investment";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { PocValidationAnalysis } from "@/lib/phases/poc-validation/schema";
import type { SolutionConsultantAnalysis } from "@/lib/phases/solution-consultant/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

const MODE_EMPHASIS: Record<ProjectMode, string> = {
  HACKATHON:
    "Emphasize the problem, differentiation, 24-hour feasibility, the POC, the demo, and how the jury will react. Your implementationNarrative should speak in terms of a 24-hour priority, demo scope, and what a judge will actually see.",
  PBL: "Emphasize the problem, methodology, academic validation, experimentation, and documentation.",
  STARTUP:
    "Emphasize the customer, the market, the business model, feasibility, scaling, and investment readiness.",
  RESEARCH:
    "Emphasize the research question, novelty, methodology, evidence quality, and limitations.",
  ZERO_DEGREE:
    "Emphasize strategic fit, productization potential, community value, research value, and future commercialization.",
};

export function buildSystemInstruction(mode: ProjectMode, criteria: readonly string[]): string {
  return [
    "You are the Report Generator inside PRISM, Phase 10 — the Final Intelligence Dossier & Decision Synthesis. This is the last phase. PRISM has investigated the problem through nine intelligence layers; your only job is to SYNTHESIZE what was already found into one authoritative dossier. You must not simply concatenate the previous phase outputs, and you must not introduce a single new factual claim, statistic, source, or research finding that wasn't already established upstream. Synthesis means summarizing, connecting, prioritizing, and recommending — never inventing.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "Wherever a section needs to point at a specific upstream fact — the most important gap, the pains worth featuring, the solutions worth featuring, the red team's strongest attack, the jury's hardest questions — return the REAL id from that phase's own output (gapId, painPoint localId, solution localId, red-team pointId, assumptionId, failureId, juryQuestion questionId). Never invent a new one. If nothing genuinely fits a slot (e.g. no failure mode plausibly threatens adoption), you may leave that specific nullable slot null rather than forcing a weak match.",
    "",
    "DECISION TRACE: fill in `decisionTrace` for all eight fixed stages (problem, pain, gap, opportunity, market, feasibility, solution, validation) — for each, state the actual finding from that phase and the real evidence (source ids or phase-local claim ids) it rests on. This is what lets a future UI answer 'why does PRISM believe this?' — never leave a stage generic or copy-pasted between stages.",
    "",
    "EXECUTIVE SUMMARY: answer each of the ten questions (what is the problem, who has it, why it matters, what already exists, what is missing, what opportunity exists, can it be built, what should be built, what is the biggest risk, what should the team do next) concisely — a few sentences each, never a restatement of an entire phase's output.",
    "",
    "RED TEAM AND JURY: you are not re-running the red team or the jury — Phase 09 already did that. Your job is to select which of Phase 09's own points are the most important to feature in the dossier (the strongest attack, the most fragile assumption, the biggest technical/market/adoption risk if one genuinely exists, the most likely failure) and which jury questions are the hardest the team will actually face.",
    "",
    "NEXT ACTION PLAN: generate a concrete, practical list of what the team should do starting tomorrow morning — dynamically from the actual problem and the gaps this investigation surfaced, never a generic checklist. Order by priority and dependency.",
    "",
    "BUILD RECOMMENDATION: give your own honest opinion (BUILD, BUILD_WITH_CHANGES, VALIDATE_BEFORE_BUILD, RESEARCH_BEFORE_BUILD, DO_NOT_BUILD, or INSUFFICIENT_EVIDENCE) with reasoning. This is your opinion; PRISM's actual final decision is computed deterministically afterward from Phases 04–09's real state and can never be more optimistic than what you propose is allowed to be — so give your most honest read rather than trying to guess the 'right' answer. PRISM must be comfortable concluding this is a bad idea, or that the problem is real but the solution isn't ready.",
    "",
    "SECTION IMPORTANCE: rate each section's importance honestly (CRITICAL/HIGH/MEDIUM/LOW). Not everything can be CRITICAL — reserve it for sections that would change the final decision if they were wrong (typically feasibility, the gap, and the final verdict itself when something is genuinely at stake). The composer will cap how many sections you mark CRITICAL, so use it sparingly and honestly.",
    "",
    "CONSULTANT VOICE: `finalConsultantMessage` should read like an experienced, confident, direct, slightly witty, honest, constructive consultant talking straight to the user — generated fresh from what this specific investigation found, never a stock phrase.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. ${MODE_EMPHASIS[mode]} Keep these evaluation lenses in mind where relevant: ${criteria.join(", ")}.`,
    "",
    "Do not perform new research and do not cite a source id that wasn't already given to you.",
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  problemAnatomy: ProblemAnatomy,
  stakeholderPain: StakeholderPainAnalysis,
  existingSolutions: ExistingSolutionsAnalysis,
  gapIntelligence: GapIntelligenceAnalysis,
  opportunityInnovation: OpportunityInnovationAnalysis,
  marketInvestment: MarketInvestmentAnalysis,
  technicalFeasibility: TechnicalFeasibilityAnalysis,
  solutionConsultant: SolutionConsultantAnalysis,
  pocValidation: PocValidationAnalysis,
): string {
  const painLines =
    stakeholderPain.painPoints.length > 0
      ? stakeholderPain.painPoints
          .map((p) => `- [${p.localId}] ${p.painTitle} (severity ${p.severityScore.overall.value}, stakeholder ${p.stakeholderLocalId})`)
          .join("\n")
      : "(No pain points identified.)";

  const solutionLines =
    existingSolutions.solutions.length > 0
      ? existingSolutions.solutions
          .map((s) => `- [${s.localId}] ${s.name} (${s.solutionType}, ${s.deploymentStatus})`)
          .join("\n")
      : "(No existing solutions identified.)";

  const gapLines =
    gapIntelligence.gapCandidates.length > 0
      ? gapIntelligence.gapCandidates
          .map((g) => `- [${g.gapId}] (${g.gapState}) ${g.title}`)
          .join("\n")
      : "(No gap candidates identified.)";

  const leadingOpportunity = selectLeadingOpportunity(opportunityInnovation);
  const opportunitySection = leadingOpportunity
    ? `Leading opportunity: [${leadingOpportunity.opportunityId}] ${leadingOpportunity.title} (${leadingOpportunity.opportunityState})\nDescription: ${leadingOpportunity.description}`
    : `Phase 05 found no meaningful opportunity (${opportunityInnovation.overallFinding}). Do not manufacture one.`;

  const criticalBlockerLines =
    technicalFeasibility.criticalBlockers.length > 0
      ? technicalFeasibility.criticalBlockers
          .map((b) => `- ${b.title} (${b.category}): ${b.description}`)
          .join("\n")
      : "(Phase 07 identified no critical blockers.)";

  const solutionSection = solutionConsultant.solution
    ? [
        `Recommended solution: [${solutionConsultant.solution.solutionId}] ${solutionConsultant.solution.name} (${solutionConsultant.solution.solutionType})`,
        `Tagline: ${solutionConsultant.solution.tagline}`,
        `Solution reality check (Phase 08): ${solutionConsultant.solutionRealityCheck.status} — ${solutionConsultant.solutionRealityCheck.explanation}`,
      ].join("\n")
    : `Phase 08 recommended no solution (reality check: ${solutionConsultant.solutionRealityCheck.status} — ${solutionConsultant.solutionRealityCheck.explanation}).`;

  const assumptionLines = pocValidation.assumptionRegister
    .map((a) => `- [${a.assumptionId}] (${a.status}, ${a.category}) ${a.assumption}`)
    .join("\n");

  const redTeamPointLines = pocValidation.redTeamReview.points
    .map((p) => `- [${p.pointId}] (${p.category}, ${p.severity}) ${p.argument}`)
    .join("\n");

  const failureModeLines = pocValidation.failureModes
    .map((f) => `- [${f.failureId}] ${f.failure} (likelihood ${f.likelihood}, severity ${f.severity})`)
    .join("\n");

  const juryQuestionLines = pocValidation.juryQuestions
    .map((q) => `- [${q.questionId}] ${q.question} (answerStatus: ${q.answerStatus})`)
    .join("\n");

  return [
    `Problem: ${problemStatement}`,
    `Problem restatement (Phase 01): ${problemAnatomy.restatement}`,
    `Problem clarity: ${problemAnatomy.clarity.isWellDefined ? "well-defined" : "has open issues"} — ${problemAnatomy.clarity.issues.join("; ") || "none noted"}`,
    `Open questions (Phase 01): ${problemAnatomy.openQuestions.join("; ") || "(none)"}`,
    "",
    "Pain points (Phase 02):",
    painLines,
    `Primary pain: ${stakeholderPain.primaryPain.painLocalId} — ${stakeholderPain.primaryPain.reasoning}`,
    "",
    "Existing solutions (Phase 03):",
    solutionLines,
    "",
    "Gaps (Phase 04):",
    gapLines,
    `Gap reality check: ${gapIntelligence.gapRealityCheck.signal} — ${gapIntelligence.gapRealityCheck.explanation}`,
    "",
    opportunitySection,
    `Opportunity reality check: ${opportunityInnovation.opportunityRealityCheck.signal} — ${opportunityInnovation.opportunityRealityCheck.explanation}`,
    "",
    `Market summary (Phase 06): ${marketInvestment.marketSummary}`,
    `Market reality check: ${marketInvestment.marketRealityCheck.signal} — ${marketInvestment.marketRealityCheck.explanation}`,
    `Investment reality check: ${marketInvestment.investmentRealityCheck.signal} — ${marketInvestment.investmentRealityCheck.explanation}`,
    "",
    `Overall feasibility (Phase 07): ${technicalFeasibility.overallFeasibility.status} — ${technicalFeasibility.overallFeasibility.explanation}`,
    "Critical blockers (Phase 07):",
    criticalBlockerLines,
    "",
    "Solution recommendation (Phase 08):",
    solutionSection,
    "",
    `Final validation decision (Phase 09): ${pocValidation.finalValidationDecision}`,
    `Validation confidence: ${pocValidation.confidenceSummary.overallConfidence} — ${pocValidation.confidenceSummary.narrative}`,
    `Build recommendation from validation (Phase 09): ${pocValidation.buildRecommendation}`,
    "Assumption register (Phase 09):",
    assumptionLines,
    `Critical assumption (Phase 09): [${pocValidation.criticalAssumption.assumptionId}] — ${pocValidation.criticalAssumption.reasoning}`,
    "Red team points (Phase 09):",
    redTeamPointLines,
    "Failure modes (Phase 09):",
    failureModeLines,
    "Jury questions (Phase 09):",
    juryQuestionLines,
    "",
    "Produce the full Intelligence Dossier synthesis now, referencing only real ids from the lists above.",
  ].join("\n");
}
