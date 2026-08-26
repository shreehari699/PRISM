import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getClientEnv } from "@/lib/config/env.client";

/**
 * Refreshes the Supabase auth session on every request. This must run in
 * middleware (not just in Server Components) because Server Components
 * cannot write cookies — without this, a session nearing expiry would
 * intermittently look logged-out.
 *
 * Route protection itself is intentionally NOT done here — every
 * server-side data access path re-checks ownership against
 * `auth.uid()` via RLS, so a gap in this middleware's matcher can never
 * become an authorization bypass, only a UX inconvenience.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getClientEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session if expired. Required for Server Components,
  // which cannot set cookies themselves.
  await supabase.auth.getUser();

  return response;
}
