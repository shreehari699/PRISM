import "server-only";

import type { MarketEvidenceSourceInput } from "@/lib/agents/market-agent/prompt";
import type { MarketAgentOutput } from "@/lib/agents/market-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { investmentAgentOutputSchema, type InvestmentAgentOutput } from "./schema";

export * from "./schema";

/**
 * `marketAnalysis` comes from the Market Agent call that already ran
 * earlier in this same phase execution — see
 * src/lib/phases/market-investment — so it isn't part of `context`, the
 * same pattern the Pain Analyst uses for the Stakeholder Analyst's
 * output in Phase 02. `sources` is the same evidence list the Market
 * Agent was shown — this agent's own output is validated against those
 * same source ids, so it must be shown them too rather than left to
 * guess or reach for an id from a different phase.
 */
export async function runInvestmentAgent(
  context: PhaseExecutionContext,
  leadingOpportunity: Opportunity | null,
  marketAnalysis: MarketAgentOutput,
  sources: MarketEvidenceSourceInput[],
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<InvestmentAgentOutput>> {
  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(context.problemStatement, leadingOpportunity, marketAnalysis, sources),
    schema: investmentAgentOutputSchema,
    temperature: 0.35,
  });
}
