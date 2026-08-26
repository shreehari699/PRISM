import { afterEach, describe, expect, it, vi } from "vitest";

import { TavilyResearchProvider } from "./tavily";

describe("TavilyResearchProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unavailable when no API key is configured", async () => {
    const provider = new TavilyResearchProvider(undefined);
    expect(provider.isConfigured).toBe(false);

    const result = await provider.search({ query: "test", maxResults: 5 });
    expect(result.status).toBe("unavailable");
  });

  it("normalizes a successful response into ResearchSource[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        results: [
          {
            title: "USDA smallholder pricing report",
            url: "https://www.usda.gov/report",
            content: "Farmers face a 22% average price variance.",
            score: 0.87,
            published_date: "2025-01-15",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TavilyResearchProvider("test-key");
    const result = await provider.search({ query: "crop pricing", maxResults: 5 });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]).toMatchObject({
        title: "USDA smallholder pricing report",
        url: "https://www.usda.gov/report",
        sourceType: "government",
        relevance: 0.87,
        publishedDate: "2025-01-15",
      });
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a typed error when the API responds with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    const provider = new TavilyResearchProvider("bad-key");
    const result = await provider.search({ query: "test", maxResults: 5 });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/401/);
    }
  });

  it("returns a typed error rather than throwing when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const provider = new TavilyResearchProvider("test-key");
    const result = await provider.search({ query: "test", maxResults: 5 });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/network down/);
    }
  });
});
