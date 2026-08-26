import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { opportunityAgentOutputSchema, type OpportunityAgentOutput } from "./schema";

export * from "./schema";

/**
 * Requires all four of `problem_intelligence`, `stakeholder_pain`,
 * `existing_solutions`, and `gap_intelligence` from
 * `context.upstreamOutputs`. The phase engine's orchestrator gating
 * already guarantees the approval-gated ones among these are approved
 * before Phase 05 can run — this re-parse is the same defense-in-depth
 * every prior phase applies to its own upstream input.
 */
export async function runOpportunityAgent(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<OpportunityAgentOutput>> {
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

  if (
    !problemAnatomy.success ||
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success
  ) {
    return {
      status: "error",
      message:
        "Phase 01, 02, 03, and/or 04 output is missing or does not match the expected shape — cannot run Phase 05.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      problemAnatomy.data,
      stakeholderPain.data,
      existingSolutions.data,
      gapIntelligence.data,
    ),
    schema: opportunityAgentOutputSchema,
    temperature: 0.35,
  });
}
