import { z } from "zod";

/**
 * `.env` files routinely declare an unused optional variable as an empty
 * string (`FOO=`) rather than omitting the line entirely. Treat that the
 * same as unset, so an optional field's `.min(1)`/`.url()` validation
 * doesn't reject a deployment that simply isn't using that variable.
 */
function optionalString<S extends z.ZodTypeAny>(schema: S) {
  return z.preprocess(
    (val) => (val === "" ? undefined : val),
    schema.optional(),
  );
}

/**
 * Variables safe to read in client components (must be prefixed
 * NEXT_PUBLIC_ by Next.js convention, which is what keeps them out of
 * server-only bundles from leaking the other direction).
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_APP_URL: optionalString(z.url()),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Variables that must never reach the browser. Only ever imported from
 * files guarded with `import "server-only"`.
 */
export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z
    .string()
    .min(1)
    .default("gemini-2.5-flash"),

  // Optional research providers — the research layer must degrade to a
  // real "unavailable" state, never fabricate results, if these are unset.
  RESEARCH_PROVIDER: z
    .enum(["none", "tavily", "serpapi", "bing"])
    .default("none"),
  TAVILY_API_KEY: optionalString(z.string().min(1)),
  SERPAPI_API_KEY: optionalString(z.string().min(1)),
  BING_SEARCH_API_KEY: optionalString(z.string().min(1)),

  // Free-tier safety limits — configurable per deployment, never implicitly
  // unlimited. See src/lib/usage.
  USAGE_DAILY_AI_REQUEST_LIMIT: z.coerce.number().int().positive().default(50),
  USAGE_MONTHLY_AI_REQUEST_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  USAGE_DAILY_RESEARCH_REQUEST_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(30),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
