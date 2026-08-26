import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import {
  questionGeneratorOutputSchema,
  type QuestionGeneratorOutput,
} from "./schema";

/**
 * Requires BOTH `problem_intelligence` and `stakeholder_pain` from
 * `context.upstreamOutputs`. The phase engine's orchestrator gating
 * already guarantees both are approved before Phase 03 can run at all —
 * this re-parse is the same defense-in-depth every prior phase applies
 * to its own upstream input.
 */
export async function runResearchQuestionGenerator(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<QuestionGeneratorOutput>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );

  if (!problemAnatomy.success || !stakeholderPain.success) {
    return {
      status: "error",
      message:
        "Phase 01 and/or Phase 02 output is missing or does not match the expected shape — cannot run Phase 03.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(problemAnatomy.data, stakeholderPain.data),
    schema: questionGeneratorOutputSchema,
    temperature: 0.4,
  });
}
