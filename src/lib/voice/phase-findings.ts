/**
 * Turns a phase's own (already-validated, already-persisted) output into
 * one real, dynamic sentence for the "phase complete" voice narration.
 * Every number and word here is read straight out of that phase's actual
 * result — never a fixed line played the same way for every run. If the
 * stored output doesn't parse against its own schema (should never
 * happen — it was validated before being persisted), this falls back to
 * a generic, still-honest line rather than fabricating a number.
 */
import { problemAnatomySchema } from "@/lib/agents/problem-analyst/schema";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { intelligenceDossierAnalysisSchema } from "@/lib/phases/intelligence-dossier/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import type { PrismPhaseKey } from "@/lib/prism/phases";
import { pocValidationAnalysisSchema } from "@/lib/phases/poc-validation/schema";
import { solutionConsultantAnalysisSchema } from "@/lib/phases/solution-consultant/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function describePhaseFindings(phaseKey: PrismPhaseKey, outputData: unknown): string | null {
  switch (phaseKey) {
    case "problem_intelligence": {
      const parsed = problemAnatomySchema.safeParse(outputData);
      if (!parsed.success) return null;
      const { who, assumptions, openQuestions } = parsed.data;
      return `${plural(who.length, "affected group")} identified, along with ${plural(assumptions.length, "assumption")} and ${plural(openQuestions.length, "open question")}.`;
    }
    case "stakeholder_pain": {
      const parsed = stakeholderPainAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `${plural(parsed.data.painPoints.length, "key pain point")} were identified across ${plural(parsed.data.stakeholders.length, "stakeholder group")}.`;
    }
    case "existing_solutions": {
      const parsed = existingSolutionsAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return parsed.data.solutions.length === 0
        ? "No existing solution was found to already address this problem."
        : `${plural(parsed.data.solutions.length, "existing solution")} were found, from ${plural(parsed.data.stats.sourcesUsed, "source")}.`;
    }
    case "gap_intelligence": {
      const parsed = gapIntelligenceAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `${plural(parsed.data.confirmedGaps.length, "confirmed gap")} and ${plural(parsed.data.candidateGaps.length, "candidate gap")} identified. Signal: ${parsed.data.gapRealityCheck.signal.replaceAll("_", " ").toLowerCase()}.`;
    }
    case "opportunity_innovation": {
      const parsed = opportunityInnovationAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return parsed.data.opportunities.length === 0
        ? "No meaningful opportunity emerged from the gaps found so far."
        : `${plural(parsed.data.opportunities.length, "candidate opportunity")} identified.`;
    }
    case "market_investment": {
      const parsed = marketInvestmentAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `Market signal: ${parsed.data.marketRealityCheck.signal.replaceAll("_", " ").toLowerCase()}. Investment case: ${parsed.data.investmentRealityCheck.signal.replaceAll("_", " ").toLowerCase()}.`;
    }
    case "technical_feasibility": {
      const parsed = technicalFeasibilityAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `Feasibility: ${parsed.data.overallFeasibility.status.replaceAll("_", " ").toLowerCase()}, with ${plural(parsed.data.criticalBlockers.length, "critical blocker")}.`;
    }
    case "solution_consultant": {
      const parsed = solutionConsultantAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return parsed.data.solution
        ? `A solution was proposed: ${parsed.data.solution.name}.`
        : "No solution was recommended at this stage.";
    }
    case "poc_validation": {
      const parsed = pocValidationAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `Validation decision: ${parsed.data.finalValidationDecision.replaceAll("_", " ").toLowerCase()}, with ${plural(parsed.data.failureModes.length, "failure mode")} identified.`;
    }
    case "intelligence_dossier": {
      const parsed = intelligenceDossierAnalysisSchema.safeParse(outputData);
      if (!parsed.success) return null;
      return `Final verdict: ${parsed.data.finalVerdict.decision.replaceAll("_", " ").toLowerCase()}. ${parsed.data.finalVerdict.reason}`;
    }
    default: {
      const exhaustive: never = phaseKey;
      return exhaustive;
    }
  }
}
