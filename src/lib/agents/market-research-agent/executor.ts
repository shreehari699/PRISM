import "server-only";

import type { ResearchProvider } from "@/lib/research";

import type { MarketPhaseSource, MarketResearchQueryPlanItem } from "./schema";

/**
 * The same dedupe + sequential-execute glue Phase 03's research-agent
 * uses (`@/lib/agents/research-agent/executor.ts`), duplicated here only
 * because the element types differ (this phase's own query-category
 * vocabulary) — both call the exact same injected `ResearchProvider`,
 * so this is not a second research provider, just this phase's own thin
 * pipeline glue over the one shared abstraction.
 */
export function dedupeMarketQueries(
  queries: MarketResearchQueryPlanItem[],
): MarketResearchQueryPlanItem[] {
  const seen = new Set<string>();
  const deduped: MarketResearchQueryPlanItem[] = [];

  for (const query of queries) {
    const key = query.query.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(query);
  }

  return deduped;
}

export interface ExecuteMarketQueriesOutcome {
  sources: MarketPhaseSource[];
  queriesExecuted: number;
  researchFailures: number;
}

export async function executeMarketResearchQueries(
  queries: MarketResearchQueryPlanItem[],
  provider: ResearchProvider,
): Promise<ExecuteMarketQueriesOutcome> {
  const deduped = dedupeMarketQueries(queries);
  const seenUrls = new Set<string>();
  const sources: MarketPhaseSource[] = [];
  let researchFailures = 0;
  let localIdCounter = 0;

  for (const query of deduped) {
    const result = await provider.search({ query: query.query, maxResults: 5 });

    if (result.status !== "ok") {
      researchFailures += 1;
      continue;
    }

    for (const source of result.sources) {
      if (seenUrls.has(source.url)) continue;
      seenUrls.add(source.url);

      localIdCounter += 1;
      sources.push({
        ...source,
        sourceLocalId: `market-source-${localIdCounter}`,
        query: query.query,
        category: query.category,
      });
    }
  }

  return { sources, queriesExecuted: deduped.length, researchFailures };
}
