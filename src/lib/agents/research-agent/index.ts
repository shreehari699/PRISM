import "server-only";

import { getAiProvider, type AiProvider } from "@/lib/ai";
import { getResearchProvider, type ResearchProvider } from "@/lib/research";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { checkUsage, recordUsage } from "@/lib/usage";

import { executeResearchQueries } from "./executor";
import { runResearchQuestionGenerator } from "./question-generator";
import type { ResearchAgentResult } from "./schema";

export * from "./schema";
export { dedupeQueries, executeResearchQueries } from "./executor";
export { runResearchQuestionGenerator } from "./question-generator";

/**
 * Combines query generation (one Gemini call) with Tavily execution
 * into the single "research operation" Phase 03 treats as one unit of
 * the `research` usage quota — regardless of how many individual
 * queries get deduplicated and executed underneath. The Gemini call's
 * own cost is covered by the phase engine's existing, unmodified `ai`
 * usage check around the whole phase run; this function only concerns
 * itself with the *research* quota, which the generic engine knows
 * nothing about.
 *
 * If the research budget is already exhausted, this returns `ok` with
 * `budgetExhausted: true` rather than a failure — running out of free
 * research capacity is a legitimate, expected PRISM outcome (the phase
 * composer still produces a complete, honest result), not an error.
 */
export async function runResearchAgent(
  context: PhaseExecutionContext,
  aiProvider: AiProvider = getAiProvider(),
  researchProvider: ResearchProvider = getResearchProvider(),
): Promise<ResearchAgentResult> {
  if (!context.userId) {
    return {
      status: "error",
      message: "Cannot run research without an authenticated userId in context.",
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

  const questionResult = await runResearchQuestionGenerator(context, aiProvider);
  if (questionResult.status !== "ok") {
    return questionResult;
  }

  const { sources, queriesExecuted, researchFailures } =
    await executeResearchQueries(questionResult.data.queries, researchProvider);

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
