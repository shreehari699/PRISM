import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { problemAnatomySchema } from "@/lib/agents/problem-analyst/schema";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { solutionConsultantAnalysisSchema } from "@/lib/phases/solution-consultant/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { validationAgentOutputSchema, type ValidationAgentOutput } from "./schema";

export * from "./schema";

/**
 * Requires all eight prior phases from `context.upstreamOutputs`. The
 * orchestrator's gating already guarantees the approval-gated ones among
 * these are approved before Phase 09 can run at all; this re-parse is
 * the same defense-in-depth every prior phase applies to its own
 * upstream input.
 */
export async function runValidationAgent(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<ValidationAgentOutput>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
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
  const solutionConsultant = solutionConsultantAnalysisSchema.safeParse(
    context.upstreamOutputs.solution_consultant,
  );

  if (
    !problemAnatomy.success ||
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success ||
    !opportunityInnovation.success ||
    !marketInvestment.success ||
    !technicalFeasibility.success ||
    !solutionConsultant.success
  ) {
    return {
      status: "error",
      message:
        "Phase 01, 02, 03, 04, 05, 06, 07, and/or 08 output is missing or does not match the expected shape — cannot run Phase 09.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      context.problemStatement,
      problemAnatomy.data,
      stakeholderPain.data,
      existingSolutions.data,
      gapIntelligence.data,
      opportunityInnovation.data,
      marketInvestment.data,
      technicalFeasibility.data,
      solutionConsultant.data,
    ),
    schema: validationAgentOutputSchema,
    temperature: 0.4,
  });
}
