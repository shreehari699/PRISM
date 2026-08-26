import { NextResponse } from "next/server";

import { checkServerEnv } from "@/lib/config/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostics endpoint. Reports whether required configuration is
 * present — never the values themselves, and never a live upstream call
 * (no reason to spend AI/research quota just to answer a health check).
 */
export async function GET() {
  const env = checkServerEnv();

  const body = {
    status: env.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      configuration: env.ok
        ? { ok: true }
        : { ok: false, missing: env.missing },
    },
  } as const;

  return NextResponse.json(body, { status: env.ok ? 200 : 503 });
}
