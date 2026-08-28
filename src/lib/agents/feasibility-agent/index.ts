import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { selectLeadingOpportunity } from "@/lib/phases/market-investment";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { feasibilityAgentOutputSchema, type FeasibilityAgentOutput } from "./schema";

export * from "./schema";

/**
 * Requires `problem_intelligence`, `stakeholder_pain`, `existing_solutions`,
 * `gap_intelligence`, `opportunity_innovation`, and `market_investment` from
 * `context.upstreamOutputs` — all six prior phases. The orchestrator's
 * gating already guarantees the approval-gated ones among these are
 * approved before Phase 07 can run at all; this re-parse is the same
 * defense-in-depth every prior phase applies to its own upstream input.
 * The leading opportunity is re-derived via the exact same
 * `selectLeadingOpportunity` Phase 06 uses, rather than a second
 * selection algorithm.
 */
export async function runFeasibilityAgent(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<FeasibilityAgentOutput>> {
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

  if (
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success ||
    !opportunityInnovation.success ||
    !marketInvestment.success
  ) {
    return {
      status: "error",
      message:
        "Phase 02, 03, 04, 05, and/or 06 output is missing or does not match the expected shape — cannot run Phase 07.",
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
      existingSolutions.data,
      marketInvestment.data,
    ),
    schema: feasibilityAgentOutputSchema,
    temperature: 0.35,
    // Every `sourceIds` field this schema has (nested throughout its
    // richEvidenceClaim/marketNumber fields) is validated by the
    // composer against these same real Phase 06 source ids — see
    // `sourceIdVocabulary` on `AiGenerateParams`.
    sourceIdVocabulary: marketInvestment.data.marketEvidence.sources.map((s) => s.sourceLocalId),
  });
}
