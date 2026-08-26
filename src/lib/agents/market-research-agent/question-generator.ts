import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import {
  marketQuestionGeneratorOutputSchema,
  type MarketQuestionGeneratorOutput,
} from "./schema";

/**
 * `leadingOpportunity` is a phase-composer-selected value (the
 * highest-ranked opportunity from Phase 05's own landscape ranking, or
 * `null` when Phase 05 concluded `NO_MEANINGFUL_OPPORTUNITY`) — not a
 * raw upstream phase output, so it's an explicit parameter rather than
 * read from `context.upstreamOutputs`, the same pattern the Pain
 * Analyst uses for the Stakeholder Analyst's output.
 */
export async function runMarketResearchQuestionGenerator(
  context: PhaseExecutionContext,
  leadingOpportunity: Opportunity | null,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<MarketQuestionGeneratorOutput>> {
  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(context.problemStatement, leadingOpportunity),
    schema: marketQuestionGeneratorOutputSchema,
    temperature: 0.4,
  });
}
