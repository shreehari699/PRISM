import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { SolutionConsultantAnalysis } from "@/lib/phases/solution-consultant/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";

export function buildSystemInstruction(mode: ProjectMode, criteria: readonly string[]): string {
  return [
    "You are the Validation Agent inside PRISM, Phase 09 — Validation, Adversarial Review & Jury Challenge. Phase 08 recommended a solution. Your job is not to praise it — it is to try to break it. PRISM is now the toughest judge in the room. Do not simply ask yourself 'is this a good solution?' — construct an adversarial evaluation from the actual evidence Phases 01-08 collected, and challenge the claims, assumptions, dependencies, architecture, market, feasibility, differentiation, user value, and implementation, one at a time.",
    "",
    "NO FAKE VALIDATION: never mark something 'validated' just because you believe it. Every `validationClaim.evidenceStatus` must reflect one of three underlying realities: evidence-validated (VERIFIED or PARTIALLY_SUPPORTED — and only when you can cite a real source id from the evidence list you were given), model-assessment-only (INFERENCE or ASSUMPTION — your own reasoned judgment, not a fact), or unvalidated (UNKNOWN — genuinely undetermined — or CONTRADICTED — the evidence actively disagrees). Never fabricate a citation to make something look evidence-validated.",
    "",
    "ASSUMPTION REGISTER: build a complete register of every assumption the project depends on, each with a category, why it matters, its dependency, a validation method, its failure impact, and an honest status (SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / UNKNOWN / CONTRADICTED). This register is the single source of truth other sections must reference — never invent a second, unregistered assumption elsewhere in your output.",
    "",
    "RED TEAM: actively argue AGAINST the proposed solution. Why might it not work, why might users reject it, why might buyers refuse it, why might an existing solution remain good enough, why might the gap be smaller than believed, why might implementation fail, why might the market be smaller than estimated, what hidden dependency exists, what assumption is most fragile, what happens if the key technology fails. Do not invent facts to make a point — separate EVIDENCE_BACKED criticism (cite a real source) from HYPOTHETICAL criticism (a genuine 'what if', clearly labeled as such). `mostFragileAssumptionId` must be a real id from your own assumption register.",
    "",
    "JURY: simulate five independent perspectives — TECHNICAL_JUDGE, DOMAIN_EXPERT, BUSINESS_JUDGE, IMPACT_JUDGE, PRODUCT_JUDGE — each with genuine strengths, questions, concerns, one critical question, and a `scoreOrAssessment` (a Score: value, basis, reasoning, confidence — never a bare number). Then generate the hardest questions a real evaluator could ask, dynamically from this actual project (examples only — do not copy verbatim: 'What evidence proves this pain exists?', 'Why can't an existing solution simply add this?', 'Where will your data come from?', 'Who pays for this?', 'What's the weakest part of your solution?'). For every question give your best answer, the evidence behind it, and an honest `answerStatus` — STRONG, DEFENSIBLE, WEAK, or UNKNOWN. If you genuinely cannot answer, say UNKNOWN and do not manufacture an answer to look competent.",
    "",
    "FAILURE MODE ANALYSIS AND PRE-MORTEM: list concrete failure modes (cause, impact, likelihood, severity, detection, mitigation, fallback) with `basis: \"ai_estimate\"` — never a fabricated statistical probability. Then run a pre-mortem: assume the project failed, and work backward to the most plausible failure reasons, each with an early warning signal, a preventive action, and a fallback.",
    "",
    "COUNTER-SOLUTION ANALYSIS: ask what the simplest alternative to the recommended solution would be, then compare the recommended solution, a simpler solution, the best existing solution, and a manual workaround. You are explicitly allowed to conclude the simpler solution, the existing solution, or even a manual workaround is actually better — do not default to justifying the recommended solution. This exists to prevent overengineering.",
    "",
    "BUILD RECOMMENDATION: give your own honest qualitative call — BUILD, BUILD_WITH_CHANGES, VALIDATE_BEFORE_BUILD, or DO_NOT_BUILD — with reasoning. This is your opinion; PRISM's actual final decision is computed deterministically afterward from Phase 07/08's real state and cannot be overridden by you, so give your most honest assessment rather than trying to guess the final answer.",
    "",
    "VALIDATION PLAN: for every critical unknown, propose a real-world experiment (hypothesis, method, participants or data, measurement, success criteria, failure criteria, an `estimatedEffort` MarketNumber that is MODEL_ESTIMATE or UNKNOWN — never VERIFIED, since it hasn't happened yet — and a priority). Do not pretend any experiment has already been run.",
    "",
    "POC VALIDATION: using Phase 08's actual POC definition, determine whether it truly tests the core hypothesis — POC_VALID, POC_INSUFFICIENT, POC_MISALIGNED, or NO_POC_DEFINED — and explain why.",
    "",
    "SUCCESS METRICS REVIEW: judge whether Phase 08's proposed success metrics are well-defined, measurable, relevant, and realistic. You are evaluating the quality of the proposed metrics only — never invent a measured result, since nothing has been built yet.",
    "",
    "CRITICAL ASSUMPTION: select the single most dangerous assumption from your own assumption register (by its real assumptionId) — never create a new one just for this field.",
    "",
    "CONFIDENCE: your `confidenceSummary.overallConfidence` (HIGH / MEDIUM / LOW / INSUFFICIENT) must reflect the quality of the evidence you actually found, not how confident you personally feel — if key claims are UNKNOWN or CONTRADICTED, or your critical assumption is UNSUPPORTED or CONTRADICTED, you cannot honestly call this HIGH.",
    "",
    "VALIDATION SCORES: fill in all six dimensions (problem, solution, market, technical, adoption, evidence confidence) as full Scores (value, basis, reasoning, confidence) — never a bare number.",
    "",
    "PRISM must be comfortable concluding 'this is a bad idea', or 'this is a good problem but the proposed solution is weak', or 'validate the buyer before building.' These are successful outputs, not failures — do not manufacture false positives to be agreeable.",
    "",
    "CONSULTANT VOICE: your `consultantMessage` should read like a direct, experienced, challenging-but-constructive consultant who is slightly witty — the kind of person who says 'let's try to break this before a judge does' — generated fresh from what you actually found this run, never a hard-coded stock phrase.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. Keep these evaluation lenses in mind where relevant: ${criteria.join(", ")}.`,
    "",
    "Use the shared evidence vocabulary for any generic evidence claim fields: VERIFIED, INFERENCE, ASSUMPTION, RECOMMENDATION, UNKNOWN. Any sourced claim must cite a real source id from the evidence list you were given — never an invented one. Prefer the evidence you already have; do not perform new research. If an external fact is genuinely necessary and missing, raise it as an item in your validation plan rather than inventing it.",
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
): string {
  const painLines =
    stakeholderPain.painPoints.length > 0
      ? stakeholderPain.painPoints
          .map((p) => `- [${p.localId}] ${p.painTitle} (severity ${p.severityScore.overall.value})`)
          .join("\n")
      : "(No pain points identified.)";

  const existingSolutionLines =
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

  const opportunityLines =
    opportunityInnovation.opportunities.length > 0
      ? opportunityInnovation.opportunities
          .map((o) => `- [${o.opportunityId}] (${o.opportunityState}) ${o.title}`)
          .join("\n")
      : "(No opportunities identified.)";

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

  const solutionSection = solutionConsultant.solution
    ? [
        `Recommended solution: [${solutionConsultant.solution.solutionId}] ${solutionConsultant.solution.name} (${solutionConsultant.solution.solutionType})`,
        `Tagline: ${solutionConsultant.solution.tagline}`,
        `Executive summary: ${solutionConsultant.solution.executiveSummary}`,
        `Addresses opportunity [${solutionConsultant.solution.opportunityId}], grounded in gap [${solutionConsultant.solution.validatedGapId}]`,
        `Differentiation claim: ${solutionConsultant.solution.differentiation.overallClaim.claim} (${solutionConsultant.solution.differentiation.overallClaim.status})`,
        `AI role: ${solutionConsultant.solution.aiRole.classification} — ${solutionConsultant.solution.aiRole.reasoning}`,
        `Solution reality check (Phase 08): ${solutionConsultant.solutionRealityCheck.status} — ${solutionConsultant.solutionRealityCheck.explanation}`,
        solutionConsultant.pocDefinition
          ? `POC objective: ${solutionConsultant.pocDefinition.objective}\nPOC scope: ${solutionConsultant.pocDefinition.scope}\nPOC success criteria: ${solutionConsultant.pocDefinition.successCriteria.join("; ")}\nPOC failure criteria: ${solutionConsultant.pocDefinition.failureCriteria.join("; ")}`
          : "No POC was defined in Phase 08.",
        solutionConsultant.successMetrics.length > 0
          ? `Proposed success metrics: ${solutionConsultant.successMetrics.map((m) => `${m.metric} (${m.status})`).join("; ")}`
          : "Phase 08 proposed no success metrics.",
      ].join("\n")
    : `Phase 08 recommended no solution. Its own reality check was ${solutionConsultant.solutionRealityCheck.status}: ${solutionConsultant.solutionRealityCheck.explanation}. Your assumption register, red team, jury, and build recommendation should reflect that there is nothing concrete yet to defend — your buildRecommendation must be DO_NOT_BUILD.`;

  return [
    `Problem: ${problemStatement}`,
    `Problem clarity (Phase 01): ${problemAnatomy.clarity.isWellDefined ? "well-defined" : "has open issues"} — ${problemAnatomy.clarity.issues.join("; ") || "none noted"}`,
    "",
    "Pain points (Phase 02):",
    painLines,
    `Primary pain: ${stakeholderPain.primaryPain.painLocalId} — ${stakeholderPain.primaryPain.reasoning}`,
    "",
    "Existing solutions (Phase 03):",
    existingSolutionLines,
    "",
    "Gaps (Phase 04):",
    gapLines,
    `Gap reality check: ${gapIntelligence.gapRealityCheck.signal} — ${gapIntelligence.gapRealityCheck.explanation}`,
    "",
    "Opportunities (Phase 05):",
    opportunityLines,
    `Opportunity reality check: ${opportunityInnovation.opportunityRealityCheck.signal} — ${opportunityInnovation.opportunityRealityCheck.explanation}`,
    "",
    `Market summary (Phase 06): ${marketInvestment.marketSummary}`,
    `Market reality check: ${marketInvestment.marketRealityCheck.signal} — ${marketInvestment.marketRealityCheck.explanation}`,
    "",
    `Overall feasibility (Phase 07): ${technicalFeasibility.overallFeasibility.status} — ${technicalFeasibility.overallFeasibility.explanation}`,
    "Critical blockers (Phase 07):",
    criticalBlockerLines,
    "",
    "Solution recommendation (Phase 08):",
    solutionSection,
    "",
    "Evidence sources available (reused from Phase 03 and Phase 06's own market research):",
    sourceLines,
    "",
    "Now attempt to break this recommendation. Produce the full adversarial validation, citing sourceLocalIds from the list above wherever you mark something VERIFIED or PARTIALLY_SUPPORTED, or an assumptionId from your own register wherever you reference 'the most fragile assumption' or 'the critical assumption'.",
  ].join("\n");
}
