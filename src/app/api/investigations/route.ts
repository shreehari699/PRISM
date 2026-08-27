import { NextResponse } from "next/server";

import {
  createInvestigation,
  createInvestigationInputSchema,
  listInvestigations,
} from "@/lib/services/investigations";
import { toHttpStatus } from "@/lib/services/result";
import { createUntypedClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists the signed-in user's own investigations, newest first — powers
 * the history page and the dashboard's recent-investigations list.
 * `listInvestigations` queries on this user-scoped client, so Row Level
 * Security is what actually confirms every row belongs to this user.
 */
export async function GET() {
  const supabase = await createUntypedClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await listInvestigations(supabase, user.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: toHttpStatus(result.code) },
    );
  }

  return NextResponse.json(result.data);
}

/**
 * Starts a new PRISM investigation: creates the project, its initial
 * problem statement, and the analysis session that will drive it
 * through the ten phases. Auth is real Supabase Auth (via the request's
 * session cookie) — there is no dev bypass here, so this 401s until a
 * sign-in flow exists to actually produce a session.
 */
export async function POST(request: Request) {
  const supabase = await createUntypedClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = createInvestigationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createInvestigation(supabase, user.id, parsed.data);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: toHttpStatus(result.code) },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
