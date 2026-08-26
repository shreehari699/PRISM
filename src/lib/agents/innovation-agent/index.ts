import "server-only";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { innovationAgentOutputSchema, type InnovationAgentOutput } from "./schema";

export * from "./schema";

/**
 * `opportunities` comes from the Opportunity Agent call that already ran
 * earlier in this same phase execution — see
 * src/lib/phases/opportunity-innovation — so it isn't part of `context`,
 * the same pattern the Pain Analyst uses for the Stakeholder Analyst's
 * output in Phase 02.
 */
export async function runInnovationAgent(
  context: PhaseExecutionContext,
  opportunities: DraftOpportunity[],
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<InnovationAgentOutput>> {
  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(context.problemStatement, opportunities),
    schema: innovationAgentOutputSchema,
    temperature: 0.35,
  });
}
