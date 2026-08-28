import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { selectLeadingOpportunity } from "@/lib/phases/market-investment";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { solutionConsultantOutputSchema, type SolutionConsultantOutput } from "./schema";

export * from "./schema";

/**
 * Requires `problem_intelligence`, `stakeholder_pain`, `existing_solutions`,
 * `gap_intelligence`, `opportunity_innovation`, `market_investment`, and
 * `technical_feasibility` from `context.upstreamOutputs` — all seven prior
 * phases. The orchestrator's gating already guarantees the approval-gated
 * ones among these are approved before Phase 08 can run at all; this
 * re-parse is the same defense-in-depth every prior phase applies to its
 * own upstream input. The leading opportunity is re-derived via the exact
 * same `selectLeadingOpportunity` Phase 06/07 use, rather than a second
 * selection algorithm.
 */
export async function runSolutionConsultant(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<SolutionConsultantOutput>> {
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  const gapIntelligence = gapIntelligenceAnalysisSchema.safeParse(
    context.upstreamOutputs.gap_intelligence,
  );
  const opportunityInnovation = opportunityInnovationAnalysisSchema.safeParse(
    context.upstreamOutputs.opportunity_innovation,
  );
  const marketInvestment = marketInvestmentAnalysisSchema.safeParse(
    context.upstreamOutputs.market_investment,
  );
  const technicalFeasibility = technicalFeasibilityAnalysisSchema.safeParse(
    context.upstreamOutputs.technical_feasibility,
  );

  if (
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success ||
    !opportunityInnovation.success ||
    !marketInvestment.success ||
    !technicalFeasibility.success
  ) {
    return {
      status: "error",
      message:
        "Phase 02, 03, 04, 05, 06, and/or 07 output is missing or does not match the expected shape — cannot run Phase 08.",
    };
  }

  const leadingOpportunity = selectLeadingOpportunity(opportunityInnovation.data);

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      context.problemStatement,
      leadingOpportunity,
      stakeholderPain.data,
      gapIntelligence.data,
      marketInvestment.data,
      technicalFeasibility.data,
    ),
    schema: solutionConsultantOutputSchema,
    temperature: 0.35,
    // Validated by the composer against these same real Phase 06 source
    // ids — see `sourceIdVocabulary` on `AiGenerateParams`.
    sourceIdVocabulary: marketInvestment.data.marketEvidence.sources.map((s) => s.sourceLocalId),
  });
}
