import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env.client";

import type { Database } from "./database.types";

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
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    },
  );
}
