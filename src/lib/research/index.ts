import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

import { NoneResearchProvider } from "./providers/none";
import { TavilyResearchProvider } from "./providers/tavily";
import type { ResearchProvider } from "./types";

export * from "./types";
export { classifySourceType } from "./classify";

let cached: ResearchProvider | undefined;

/**
 * Resolves the configured ResearchProvider. Never silently returns a
 * fake/mock provider — an unrecognized or unimplemented provider throws
 * loudly at startup rather than degrading into fabricated research.
 */
export function getResearchProvider(): ResearchProvider {
  if (cached) return cached;

  const env = getServerEnv();

  switch (env.RESEARCH_PROVIDER) {
    case "none":
      cached = new NoneResearchProvider();
      break;
    case "tavily":
      cached = new TavilyResearchProvider(env.TAVILY_API_KEY);
      break;
    case "serpapi":
    case "bing":
      throw new Error(
        `RESEARCH_PROVIDER=${env.RESEARCH_PROVIDER} is not implemented yet. Use "tavily" or "none".`,
      );
    default: {
      const exhaustive: never = env.RESEARCH_PROVIDER;
      throw new Error(`Unhandled RESEARCH_PROVIDER: ${exhaustive}`);
    }
  }

  return cached;
}
