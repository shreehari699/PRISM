import { describe, expect, it, vi } from "vitest";

import type { ResearchProvider, ResearchResult } from "@/lib/research";

import { dedupeQueries, executeResearchQueries } from "./executor";
import type { ResearchQueryPlanItem } from "./schema";

function query(overrides: Partial<ResearchQueryPlanItem> = {}): ResearchQueryPlanItem {
  return {
    query: "crop pricing platform",
    category: "COMMERCIAL",
    reason: "r",
    targetInformation: "t",
    ...overrides,
  };
}

describe("dedupeQueries", () => {
  it("removes case/whitespace-insensitive duplicates, keeping the first occurrence", () => {
    const queries = [
      query({ query: "Crop Pricing Platform", category: "COMMERCIAL" }),
      query({ query: "  crop pricing platform  ", category: "STARTUP" }),
      query({ query: "government subsidy programs", category: "GOVERNMENT" }),
    ];

    const result = dedupeQueries(queries);

    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("COMMERCIAL");
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeQueries([])).toEqual([]);
  });
});

function fakeResearchProvider(
  responses: ResearchResult[],
): ResearchProvider {
  const search = vi.fn();
  for (const response of responses) {
    search.mockResolvedValueOnce(response);
  }
  return { name: "fake", isConfigured: true, search };
}

describe("executeResearchQueries", () => {
  it("normalizes sources with a sourceLocalId, query, and category", async () => {
    const provider = fakeResearchProvider([
      {
        status: "ok",
        provider: "fake",
        sources: [
          {
            title: "eNAM platform",
            url: "https://enam.gov.in",
            sourceType: "government",
            retrievedAt: new Date().toISOString(),
            snippet: "A national electronic trading platform.",
          },
        ],
      },
    ]);

    const result = await executeResearchQueries(
      [query({ query: "eNAM", category: "GOVERNMENT" })],
      provider,
    );

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      sourceLocalId: "source-1",
      query: "eNAM",
      category: "GOVERNMENT",
      url: "https://enam.gov.in",
    });
    expect(result.queriesExecuted).toBe(1);
    expect(result.researchFailures).toBe(0);
  });

  it("continues past a failed query and tallies it as a research failure", async () => {
    const provider = fakeResearchProvider([
      { status: "error", provider: "fake", message: "timeout" },
      {
        status: "ok",
        provider: "fake",
        sources: [
          {
            title: "AgriTrade Inc",
            url: "https://agritrade.example.com",
            sourceType: "startup",
            retrievedAt: new Date().toISOString(),
            snippet: "A startup building crop pricing tools.",
          },
        ],
      },
    ]);

    const result = await executeResearchQueries(
      [
        query({ query: "query one", category: "GOVERNMENT" }),
        query({ query: "query two", category: "STARTUP" }),
      ],
      provider,
    );

    expect(result.researchFailures).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.queriesExecuted).toBe(2);
  });

  it("deduplicates sources returned by more than one query, by URL", async () => {
    const sharedSource = {
      title: "AgriTrade Inc",
      url: "https://agritrade.example.com",
      sourceType: "startup" as const,
      retrievedAt: new Date().toISOString(),
      snippet: "A startup building crop pricing tools.",
    };

    const provider = fakeResearchProvider([
      { status: "ok", provider: "fake", sources: [sharedSource] },
      { status: "ok", provider: "fake", sources: [sharedSource] },
    ]);

    const result = await executeResearchQueries(
      [
        query({ query: "query one", category: "STARTUP" }),
        query({ query: "query two", category: "ALTERNATIVE" }),
      ],
      provider,
    );

    expect(result.sources).toHaveLength(1);
  });

  it("treats an unavailable provider the same as a failure, without fabricating sources", async () => {
    const provider = fakeResearchProvider([
      { status: "unavailable", provider: "none", reason: "no provider configured" },
    ]);

    const result = await executeResearchQueries([query()], provider);

    expect(result.sources).toEqual([]);
    expect(result.researchFailures).toBe(1);
  });

  it("deduplicates queries before executing them", async () => {
    const provider = fakeResearchProvider([
      { status: "ok", provider: "fake", sources: [] },
    ]);

    const result = await executeResearchQueries(
      [query({ query: "same query" }), query({ query: "SAME QUERY" })],
      provider,
    );

    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(result.queriesExecuted).toBe(1);
  });
});
