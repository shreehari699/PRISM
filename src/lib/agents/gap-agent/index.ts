import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { gapAgentOutputSchema, type GapAgentOutput } from "./schema";

export * from "./schema";

/**
 * Requires all three of `problem_intelligence`, `stakeholder_pain`, and
 * `existing_solutions` from `context.upstreamOutputs`. The phase
 * engine's orchestrator gating already guarantees all three are
 * approved before Phase 04 can run at all — this re-parse is the same
 * defense-in-depth every prior phase applies to its own upstream input.
 */
export async function runGapAgent(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<GapAgentOutput>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );

  if (!problemAnatomy.success || !stakeholderPain.success || !existingSolutions.success) {
    return {
      status: "error",
      message:
        "Phase 01, 02, and/or 03 output is missing or does not match the expected shape — cannot run Phase 04.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      problemAnatomy.data,
      stakeholderPain.data,
      existingSolutions.data,
    ),
    schema: gapAgentOutputSchema,
    temperature: 0.3,
  });
}
