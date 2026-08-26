import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import {
  stakeholderAnalystOutputSchema,
  type StakeholderAnalystOutput,
} from "./schema";

export * from "./schema";

/**
 * Runs the Stakeholder Analyst. Requires `context.upstreamOutputs.problem_intelligence`
 * to already be present and valid — the phase engine's orchestrator
 * gating guarantees Phase 01 is approved before this phase can run at
 * all, but we still re-parse it here rather than trusting `unknown`
 * blindly, consistent with "never trust raw model JSON" applying to
 * data pulled back out of storage too.
 */
export async function runStakeholderAnalyst(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<StakeholderAnalystOutput>> {
  const upstream = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );

  if (!upstream.success) {
    return {
      status: "error",
      message:
        "Phase 01 (Problem Intelligence) output is missing or does not match the expected shape — cannot run Phase 02.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(upstream.data),
    schema: stakeholderAnalystOutputSchema,
    temperature: 0.3,
  });
}
