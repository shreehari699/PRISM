import { NextResponse } from "next/server";
import { z } from "zod";

import { executePhaseAction, getPhaseState } from "@/lib/services/phase-engine";
import { toHttpStatus } from "@/lib/services/result";
import { PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import { createUntypedAdminClient } from "@/lib/supabase/admin";
import { createUntypedClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string; phaseKey: string }> };

const actionBodySchema = z.object({
  action: z.enum(["run", "approve", "regenerate"]),
});

function isPhaseKey(value: string): value is PrismPhaseKey {
  return (PHASE_KEYS as string[]).includes(value);
}

async function requireUser(supabase: Awaited<ReturnType<typeof createUntypedClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error ? null : user;
}

/** Current state of one phase within a session — polled by the UI to render progress. */
export async function GET(request: Request, { params }: RouteParams) {
  const { sessionId, phaseKey } = await params;

  if (!isPhaseKey(phaseKey)) {
    return NextResponse.json(
      { error: `Unknown phase key: ${phaseKey}` },
      { status: 400 },
    );
  }

  const supabase = await createUntypedClient();
  const user = await requireUser(supabase);
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await getPhaseState(supabase, sessionId, phaseKey);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: toHttpStatus(result.code) },
    );
  }

  return NextResponse.json(result.data);
}

/**
 * Dispatches a phase workflow transition: `run`, `approve`, or
 * `regenerate`. One action-oriented endpoint rather than three
 * REST-y ones, since these are state-machine transitions, not resource
 * CRUD. All the actual gating, evidence, and persistence logic lives in
 * the phase engine — this handler only does auth, parsing, and status
 * code mapping.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { sessionId, phaseKey } = await params;

  if (!isPhaseKey(phaseKey)) {
    return NextResponse.json(
      { error: `Unknown phase key: ${phaseKey}` },
      { status: 400 },
    );
  }

  const supabase = await createUntypedClient();
  const user = await requireUser(supabase);
  if (!user) {
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

  const parsed = actionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body must be { "action": "run" | "approve" | "regenerate" }.' },
      { status: 400 },
    );
  }

  const admin = createUntypedAdminClient();

  const result = await executePhaseAction({
    supabase,
    admin,
    userId: user.id,
    sessionId,
    phaseKey,
    action: parsed.data.action,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: toHttpStatus(result.code) },
    );
  }

  return NextResponse.json(result.data);
}
