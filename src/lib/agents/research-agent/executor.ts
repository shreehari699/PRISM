import "server-only";

import type { ResearchProvider } from "@/lib/research";

import type { PhaseSource, ResearchQueryPlanItem } from "./schema";

/** Case/whitespace-insensitive dedup — keeps first occurrence, preserving the model's ordering. */
export function dedupeQueries(
  queries: ResearchQueryPlanItem[],
): ResearchQueryPlanItem[] {
  const seen = new Set<string>();
  const deduped: ResearchQueryPlanItem[] = [];

  for (const query of queries) {
    const key = query.query.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(query);
  }

  return deduped;
}

export interface ExecuteQueriesOutcome {
  sources: PhaseSource[];
  queriesExecuted: number;
  researchFailures: number;
}

/**
 * Runs every (deduplicated) query against the research provider
 * sequentially — a free-tier search API is exactly the kind of
 * dependency you don't want to hammer with concurrent requests, and
 * sequential execution keeps failure handling simple to reason about
 * and test. A single query's failure never aborts the batch: it's
 * tallied and the loop continues, so partial research is still real
 * research, never discarded because one query hit an error.
 *
 * Sources are deduplicated by URL across all queries — the same result
 * can legitimately surface from more than one query.
 */
export async function executeResearchQueries(
  queries: ResearchQueryPlanItem[],
  provider: ResearchProvider,
): Promise<ExecuteQueriesOutcome> {
  const deduped = dedupeQueries(queries);
  const seenUrls = new Set<string>();
  const sources: PhaseSource[] = [];
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
        sourceLocalId: `source-${localIdCounter}`,
        query: query.query,
        category: query.category,
      });
    }
  }

  return { sources, queriesExecuted: deduped.length, researchFailures };
}
