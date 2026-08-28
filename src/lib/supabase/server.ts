import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env.client";

import type { Database } from "./database.types";
import { createTimeoutFetch } from "./fetch-with-timeout";

async function cookieAdapter() {
  const cookieStore = await cookies();

  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(
      cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
    ) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component — middleware refreshes the
        // session instead. Safe to ignore.
      }
    },
  };
}

/**
 * Supabase client for Server Components, Route Handlers, and Server
 * Actions. Still uses only the publishable key — requests are made as
 * the signed-in user (via their session cookie), and RLS enforces
 * ownership. Use `createAdminClient` (admin.ts) only for operations that
 * genuinely need to bypass RLS.
 *
 * Server Components cannot write cookies, so `setAll` there is a no-op
 * wrapped in try/catch; session refresh in that case is handled by
 * middleware.ts instead.
 */
export async function createClient() {
  const env = getClientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: await cookieAdapter(), global: { fetch: createTimeoutFetch() } },
  );
}

/**
 * Same as `createClient`, but without the `Database` generic — for the
 * same reason `createUntypedAdminClient` exists (see admin.ts):
 * `database.types.ts` is currently a placeholder that doesn't enumerate
 * real tables. Still runs as the authenticated user via their session
 * cookie, so RLS still applies; only the TypeScript typing differs. Pair
 * with a Zod schema at the call site (see src/lib/supabase/rows.ts).
 */
export async function createUntypedClient() {
  const env = getClientEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: await cookieAdapter(), global: { fetch: createTimeoutFetch() } },
  );
}
