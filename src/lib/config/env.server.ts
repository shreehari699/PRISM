import "server-only";

import { serverEnvSchema, formatEnvError, type ServerEnv } from "./env.schema";
import { getClientEnv } from "./env.client";

let cached: ServerEnv | undefined;

/**
 * Validated server-only environment (secrets included). The `server-only`
 * import makes bundling this into a client component a build-time error,
 * not just a code-review concern.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    RESEARCH_PROVIDER: process.env.RESEARCH_PROVIDER,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    BING_SEARCH_API_KEY: process.env.BING_SEARCH_API_KEY,
    USAGE_DAILY_AI_REQUEST_LIMIT: process.env.USAGE_DAILY_AI_REQUEST_LIMIT,
    USAGE_MONTHLY_AI_REQUEST_LIMIT: process.env.USAGE_MONTHLY_AI_REQUEST_LIMIT,
    USAGE_DAILY_RESEARCH_REQUEST_LIMIT:
      process.env.USAGE_DAILY_RESEARCH_REQUEST_LIMIT,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration:\n${formatEnvError(parsed.error)}\n\nSee ENVIRONMENT.md for setup instructions.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * Non-throwing variant for diagnostics endpoints: reports which required
 * variables are missing without ever returning their values.
 */
export function checkServerEnv(): { ok: boolean; missing: string[] } {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    RESEARCH_PROVIDER: process.env.RESEARCH_PROVIDER,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    BING_SEARCH_API_KEY: process.env.BING_SEARCH_API_KEY,
    USAGE_DAILY_AI_REQUEST_LIMIT: process.env.USAGE_DAILY_AI_REQUEST_LIMIT,
    USAGE_MONTHLY_AI_REQUEST_LIMIT: process.env.USAGE_MONTHLY_AI_REQUEST_LIMIT,
    USAGE_DAILY_RESEARCH_REQUEST_LIMIT:
      process.env.USAGE_DAILY_RESEARCH_REQUEST_LIMIT,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (parsed.success) return { ok: true, missing: [] };

  const missing = parsed.error.issues.map((issue) => issue.path.join("."));
  return { ok: false, missing };
}

export { getClientEnv };
