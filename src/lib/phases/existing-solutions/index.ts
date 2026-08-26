import "server-only";

import { runExistingSolutionAgent } from "@/lib/agents/existing-solution-agent";
import { runResearchAgent } from "@/lib/agents/research-agent";
import type {
  PhaseSource,
  ResearchQueryCategory,
} from "@/lib/agents/research-agent/schema";
import { combineUsage, getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { getResearchProvider, type ResearchProvider } from "@/lib/research";

import {
  existingSolutionsAnalysisSchema,
  type CoverageLevel,
  type ExistingSolutionsAnalysis,
  type ResearchCoverage,
} from "./schema";

export * from "./schema";

const CATEGORY_TO_COVERAGE_KEY: Partial<Record<ResearchQueryCategory, keyof ResearchCoverage>> = {
  COMMERCIAL: "commercial",
  GOVERNMENT: "government",
  ACADEMIC: "academic",
  STARTUP: "startup",
  OPEN_SOURCE: "openSource",
  INTERNATIONAL: "international",
  TECHNOLOGY: "technology",
};

/**
 * A transparent, reproducible heuristic — not a model guess — based on
 * how many real sources actually surfaced for a category and how
 * relevant the research provider itself reported them to be. No
 * mathematical precision is implied by the thresholds; they only ever
 * produce one of the four qualitative bands.
 */
function computeCoverageLevel(sources: PhaseSource[]): CoverageLevel {
  if (sources.length === 0) return "INSUFFICIENT";

  const relevances = sources
    .map((s) => s.relevance)
    .filter((r): r is number => typeof r === "number");
  const avgRelevance =
    relevances.length > 0
      ? relevances.reduce((sum, r) => sum + r, 0) / relevances.length
      : 0.5; // neutral default when the provider doesn't report relevance

  const weighted = sources.length * (0.5 + avgRelevance / 2);

  if (weighted >= 4) return "HIGH";
  if (weighted >= 2) return "MEDIUM";
  return "LOW";
}

function computeResearchCoverage(sources: PhaseSource[]): ResearchCoverage {
  const byKey = new Map<keyof ResearchCoverage, PhaseSource[]>();

  for (const source of sources) {
    const key = CATEGORY_TO_COVERAGE_KEY[source.category];
    if (!key) continue;
    const bucket = byKey.get(key) ?? [];
    bucket.push(source);
    byKey.set(key, bucket);
  }

  const coverage = {} as ResearchCoverage;
  for (const key of [
    "commercial",
    "government",
    "academic",
    "startup",
    "openSource",
    "international",
    "technology",
  ] as const) {
    coverage[key] = computeCoverageLevel(byKey.get(key) ?? []);
  }
  return coverage;
}

/**
 * Phase 03 — Existing Solution Intelligence. Runs the Research Agent
 * (query generation + Tavily execution), then the Existing Solution
 * Agent grounded in whatever sources actually came back, then merges
 * them. Every number in the final `stats`/`researchCoverage` is computed
 * here in plain code from the pipeline's own bookkeeping — never asked
 * of the model — which is what makes "no fake numbers" enforceable
 * rather than just requested.
 */
export async function runExistingSolutionsPhase(
  context: PhaseExecutionContext,
  aiProvider: AiProvider = getAiProvider(),
  researchProvider: ResearchProvider = getResearchProvider(),
): Promise<AiResult<ExistingSolutionsAnalysis>> {
  const researchResult = await runResearchAgent(context, aiProvider, researchProvider);
  if (researchResult.status !== "ok") {
    return researchResult;
  }

  const { queries, sources, queriesExecuted, researchFailures, budgetExhausted } =
    researchResult;

  const solutionResult = await runExistingSolutionAgent(
    context,
    sources,
    { queriesExecuted, researchFailures, budgetExhausted },
    aiProvider,
  );
  if (solutionResult.status !== "ok") {
    return solutionResult;
  }

  const knownSourceIds = new Set(sources.map((s) => s.sourceLocalId));
  const solutionWithUnknownSource = solutionResult.data.solutions.find((solution) =>
    solution.sourceIds.some((id) => !knownSourceIds.has(id)),
  );
  if (solutionWithUnknownSource) {
    return {
      status: "invalid_output",
      message: `Solution "${solutionWithUnknownSource.name}" cites a source id that wasn't among the actual research results.`,
      raw: JSON.stringify(solutionResult.data),
    };
  }

  const usedSourceIds = new Set(
    solutionResult.data.solutions.flatMap((solution) => solution.sourceIds),
  );

  const merged = {
    queries,
    sources,
    solutions: solutionResult.data.solutions,
    researchCoverage: computeResearchCoverage(sources),
    stats: {
      sourcesFound: sources.length,
      sourcesUsed: usedSourceIds.size,
      solutionsIdentified: solutionResult.data.solutions.length,
      queriesExecuted,
      researchFailures,
      budgetExhausted,
    },
    consultantMessage: solutionResult.data.consultantMessage,
  };

  const validated = existingSolutionsAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return {
      status: "invalid_output",
      message: `Merged Phase 03 output failed schema validation: ${validated.error.message}`,
      raw: JSON.stringify(merged),
    };
  }

  const researchUsage = researchResult.budgetExhausted
    ? undefined
    : researchResult.usage;

  return {
    status: "ok",
    data: validated.data,
    model: solutionResult.model,
    usage: combineUsage(researchUsage, solutionResult.usage),
  };
}
