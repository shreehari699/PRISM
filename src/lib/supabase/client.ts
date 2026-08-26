"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env.client";

import type { Database } from "./database.types";

/**
 * Supabase client for use in Client Components. Uses only the publishable
 * (anon) key — never the service role key — so it is always safe to
 * construct in browser code. Row Level Security is what actually
 * enforces per-user access; this client has no elevated privileges.
 */
export function createClient() {
  const env = getClientEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
