import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

import { GeminiProvider } from "./gemini-provider";
import type { AiProvider } from "./types";

export * from "./types";
export { combineUsage } from "./combine-usage";

let cached: AiProvider | undefined;

/**
 * Resolves the configured AI provider. Gemini is the only implementation
 * today, but callers depend on the AiProvider interface, not this
 * function's return type, so a future provider can be swapped in here
 * without touching agent code.
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const env = getServerEnv();
  cached = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  return cached;
}
