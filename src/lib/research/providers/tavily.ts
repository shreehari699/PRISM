import "server-only";

import { z } from "zod";

import { classifySourceType } from "../classify";
import type { ResearchProvider, ResearchQuery, ResearchResult } from "../types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 15_000;

const tavilyResultSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  content: z.string().min(1),
  score: z.number().optional(),
  published_date: z.string().optional(),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).default([]),
});

export class TavilyResearchProvider implements ResearchProvider {
  readonly name = "tavily";

  constructor(private readonly apiKey: string | undefined) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: ResearchQuery): Promise<ResearchResult> {
    if (!this.apiKey) {
      return {
        status: "unavailable",
        reason: "TAVILY_API_KEY is not configured.",
        provider: this.name,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestStartedAt = Date.now();

    try {
      const response = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query.query,
          max_results: query.maxResults,
          search_depth: "advanced",
        }),
        signal: controller.signal,
      });

      // Timing/status only — never the query text or key.
      console.log(
        JSON.stringify({
          scope: "tavily-provider",
          ms: Date.now() - requestStartedAt,
          httpStatus: response.status,
        }),
      );

      if (!response.ok) {
        return {
          status: "error",
          message: `Tavily API returned ${response.status} ${response.statusText}`,
          provider: this.name,
        };
      }

      const json = await response.json();
      const parsed = tavilyResponseSchema.safeParse(json);

      if (!parsed.success) {
        return {
          status: "error",
          message: `Tavily API response did not match expected shape: ${parsed.error.message}`,
          provider: this.name,
        };
      }

      const now = new Date().toISOString();
      const sources = parsed.data.results.map((result) => {
        const publishedDate =
          result.published_date &&
          /^\d{4}-\d{2}-\d{2}/.test(result.published_date)
            ? result.published_date.slice(0, 10)
            : undefined;

        return {
          title: result.title,
          url: result.url,
          sourceType: classifySourceType(result.url),
          publishedDate,
          retrievedAt: now,
          snippet: result.content.slice(0, 500),
          relevance: result.score,
        };
      });

      return { status: "ok", sources, provider: this.name };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Tavily request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : "Unknown error calling Tavily";

      return { status: "error", message, provider: this.name };
    } finally {
      clearTimeout(timeout);
    }
  }
}
