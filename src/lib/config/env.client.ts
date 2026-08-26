import { publicEnvSchema, formatEnvError, type PublicEnv } from "./env.schema";

let cached: PublicEnv | undefined;

/**
 * Validated NEXT_PUBLIC_* environment. Safe to import from client
 * components. Throws a descriptive error at first access if
 * misconfigured, rather than letting `undefined` silently propagate into
 * a Supabase client constructor.
 */
export function getClientEnv(): PublicEnv {
  if (cached) return cached;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration:\n${formatEnvError(parsed.error)}\n\nSee ENVIRONMENT.md for setup instructions.`,
    );
  }

  cached = parsed.data;
  return cached;
}
