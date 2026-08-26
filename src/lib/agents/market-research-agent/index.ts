import "server-only";

import { getAiProvider, type AiProvider } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import { getResearchProvider, type ResearchProvider } from "@/lib/research";
import { checkUsage, recordUsage } from "@/lib/usage";

import { executeMarketResearchQueries } from "./executor";
import { runMarketResearchQuestionGenerator } from "./question-generator";
import type { MarketResearchAgentResult } from "./schema";

export * from "./schema";
export { dedupeMarketQueries, executeMarketResearchQueries } from "./executor";
export { runMarketResearchQuestionGenerator } from "./question-generator";

/**
 * Combines query generation (one Gemini call) with Tavily execution
 * into the single "research operation" Phase 06 treats as one unit of
 * the `research` usage quota — the same "research budget" discipline
 * Phase 03 established. If the leading opportunity is `null` (Phase 05
 * found no meaningful opportunity), this still runs the question
 * generator, which is instructed to return an empty query list — no
 * Tavily calls happen, but the phase stays uniform rather than adding a
 * special-cased skip path.
 *
 * If the research budget is already exhausted, this returns `ok` with
 * `budgetExhausted: true` — the phase composer still produces a
 * complete, honest result (`PARTIAL_MARKET_EVIDENCE`), never a hard
 * failure.
 */
export async function runMarketResearchAgent(
  context: PhaseExecutionContext,
  leadingOpportunity: Opportunity | null,
  aiProvider: AiProvider = getAiProvider(),
  researchProvider: ResearchProvider = getResearchProvider(),
): Promise<MarketResearchAgentResult> {
  if (!context.userId) {
    return {
      status: "error",
      message: "Cannot run market research without an authenticated userId in context.",
    };
  }

  const usage = await checkUsage(context.userId, "research");
  if (!usage.allowed) {
    return {
      status: "ok",
      queries: [],
      sources: [],
      queriesExecuted: 0,
      researchFailures: 0,
      budgetExhausted: true,
      reason:
        usage.reason ??
        "Research capacity reached. PRISM preserved the evidence already collected.",
    };
  }

  const questionResult = await runMarketResearchQuestionGenerator(
    context,
    leadingOpportunity,
    aiProvider,
  );
  if (questionResult.status !== "ok") {
    return questionResult;
  }

  const { sources, queriesExecuted, researchFailures } = await executeMarketResearchQueries(
    questionResult.data.queries,
    researchProvider,
  );

  await recordUsage(context.userId, "research", 0);

  return {
    status: "ok",
    queries: questionResult.data.queries,
    sources,
    queriesExecuted,
    researchFailures,
    budgetExhausted: false,
    usage: questionResult.usage,
  };
}
