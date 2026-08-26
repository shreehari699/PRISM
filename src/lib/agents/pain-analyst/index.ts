import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import type { DraftStakeholder } from "@/lib/agents/stakeholder-analyst/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { painAnalystOutputSchema, type PainAnalystOutput } from "./schema";

export * from "./schema";

/**
 * Runs the Pain Analyst. Like the Stakeholder Analyst, re-validates
 * `context.upstreamOutputs.problem_intelligence` itself rather than
 * trusting it as `unknown`. `stakeholders` comes from the Stakeholder
 * Analyst call that already ran earlier in this same phase execution —
 * see src/lib/phases/stakeholder-pain — so it isn't part of `context`.
 */
export async function runPainAnalyst(
  context: PhaseExecutionContext,
  stakeholders: DraftStakeholder[],
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<PainAnalystOutput>> {
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
    prompt: buildUserPrompt(upstream.data, stakeholders),
    schema: painAnalystOutputSchema,
    temperature: 0.35,
  });
}
