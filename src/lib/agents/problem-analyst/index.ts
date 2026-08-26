import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { problemAnatomySchema, type ProblemAnatomy } from "./schema";

export * from "./schema";

/**
 * Runs the Problem Analyst against a phase execution context. Accepts an
 * injectable AiProvider (defaulting to the configured Gemini provider)
 * purely for testability — callers in production never pass a second
 * argument.
 */
export async function runProblemAnalyst(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<ProblemAnatomy>> {
  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(context),
    schema: problemAnatomySchema,
    temperature: 0.3,
  });
}
