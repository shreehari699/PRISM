import "server-only";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { innovationAgentOutputSchema, type InnovationAgentOutput } from "./schema";

export * from "./schema";

/**
 * `opportunities` comes from the Opportunity Agent call that already ran
 * earlier in this same phase execution — see
 * src/lib/phases/opportunity-innovation — so it isn't part of `context`,
 * the same pattern the Pain Analyst uses for the Stakeholder Analyst's
 * output in Phase 02.
 *
 * `sources` (Phase 03's research sources) is threaded through explicitly
 * for the same reason it's threaded into the Opportunity Agent: this
 * agent's `differentiation.sourceIds` is validated against those exact
 * ids by the phase composer, so the model must actually be shown them —
 * without this, the only id-shaped tokens in its context are gap/pain/
 * opportunity ids, which it would otherwise have no way to avoid citing
 * by mistake.
 */
export async function runInnovationAgent(
  context: PhaseExecutionContext,
  opportunities: DraftOpportunity[],
  sources: PhaseSource[],
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<InnovationAgentOutput>> {
  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(context.problemStatement, opportunities, sources),
    schema: innovationAgentOutputSchema,
    temperature: 0.35,
  });
}
