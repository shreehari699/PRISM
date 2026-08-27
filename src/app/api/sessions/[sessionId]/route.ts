import { NextResponse } from "next/server";

import { getSessionOverview } from "@/lib/services/investigations";
import { toHttpStatus } from "@/lib/services/result";
import { createUntypedClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

/**
 * One round trip for the investigation dashboard: the project, its
 * problem statement, and all ten phases' current state. A thin
 * aggregation over the same tables `getPhaseState` reads one phase at a
 * time — this never touches the phase engine's write path, so approving
 * a phase or regenerating output still goes exclusively through
 * `POST /api/sessions/[sessionId]/phases/[phaseKey]`.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { sessionId } = await params;

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

  const result = await getSessionOverview(supabase, sessionId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: toHttpStatus(result.code) },
    );
  }

  return NextResponse.json(result.data);
}
