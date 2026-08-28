import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getClientEnv } from "@/lib/config/env.client";
import { getServerEnv } from "@/lib/config/env.server";

import type { Database } from "./database.types";
import { createTimeoutFetch } from "./fetch-with-timeout";

/**
 * Service-role Supabase client. This BYPASSES Row Level Security
 * entirely, so it must never be exposed to a request path that doesn't
 * independently verify the caller owns the resource being touched (e.g.
 * background jobs, usage-tracking writes, admin tooling) — application
 * request handlers should use `createClient` from server.ts instead,
 * which runs as the authenticated user and lets RLS do the enforcement.
 *
 * The `server-only` import guarantees a build-time failure if this is
 * ever imported from client code.
 */
export function createAdminClient() {
  const clientEnv = getClientEnv();
  const serverEnv = getServerEnv();

  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: createTimeoutFetch() },
    },
  );
}

/**
 * Same privileges as `createAdminClient`, but without the `Database`
 * generic. `database.types.ts` is currently a placeholder (see the
 * comment there) that doesn't enumerate real tables, so a typed client
 * can't be used against them yet. Only reach for this when you also
 * validate the query result with a Zod schema at the call site (see
 * src/lib/usage) — replace with the typed client once real generated
 * types exist.
 */
export function createUntypedAdminClient() {
  const clientEnv = getClientEnv();
  const serverEnv = getServerEnv();

  return createSupabaseClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: createTimeoutFetch() },
    },
  );
}

/**
 * Shared type for "an untyped Supabase client" — what
 * `createUntypedAdminClient` and `createUntypedClient` (server.ts) both
 * return. Service functions that accept either an admin or a
 * user-scoped client (the caller decides which by which factory it
 * calls) type their parameter as `DbClient` rather than importing both
 * factories' return types separately.
 */
export type DbClient = ReturnType<typeof createUntypedAdminClient>;
