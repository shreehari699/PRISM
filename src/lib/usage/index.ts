import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/config/env.server";
import { createUntypedAdminClient } from "@/lib/supabase/admin";

import type { UsageCheckResult, UsageKind } from "./types";

export * from "./types";

const usageRowSchema = z.object({
  ai_requests: z.number().int().nonnegative(),
  research_requests: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
});

function periodKeys(now: Date = new Date()) {
  const daily = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const monthly = now.toISOString().slice(0, 7); // YYYY-MM
  return { daily, monthly };
}

async function fetchUsageRow(
  userId: string,
  periodType: "daily" | "monthly",
  periodKey: string,
) {
  const supabase = createUntypedAdminClient();

  const { data, error } = await supabase
    .from("usage_tracking")
    .select("ai_requests, research_requests, tokens_used")
    .eq("user_id", userId)
    .eq("period_type", periodType)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read usage_tracking: ${error.message}`);
  }

  if (!data) {
    return { ai_requests: 0, research_requests: 0, tokens_used: 0 };
  }

  return usageRowSchema.parse(data);
}

function limitFor(kind: UsageKind, period: "daily" | "monthly") {
  const env = getServerEnv();

  if (kind === "research") {
    // Research has no separate monthly limit today — the daily limit is
    // the binding constraint. Treat "monthly" as unbounded rather than
    // inventing a number nobody configured.
    return period === "daily"
      ? env.USAGE_DAILY_RESEARCH_REQUEST_LIMIT
      : Infinity;
  }

  return period === "daily"
    ? env.USAGE_DAILY_AI_REQUEST_LIMIT
    : env.USAGE_MONTHLY_AI_REQUEST_LIMIT;
}

/**
 * Checks whether the given user may make one more `kind` request without
 * exceeding configured free-tier limits. Never triggers paid usage —
 * callers must treat `allowed: false` as a hard stop and surface
 * `reason` to the user (safe mode), not silently proceed.
 */
export async function checkUsage(
  userId: string,
  kind: UsageKind,
): Promise<UsageCheckResult> {
  const { daily, monthly } = periodKeys();

  const [dailyRow, monthlyRow] = await Promise.all([
    fetchUsageRow(userId, "daily", daily),
    fetchUsageRow(userId, "monthly", monthly),
  ]);

  const dailyUsed = kind === "ai" ? dailyRow.ai_requests : dailyRow.research_requests;
  const monthlyUsed =
    kind === "ai" ? monthlyRow.ai_requests : monthlyRow.research_requests;

  const dailyLimit = limitFor(kind, "daily");
  const monthlyLimit = limitFor(kind, "monthly");

  const remaining = {
    daily: Math.max(0, dailyLimit - dailyUsed),
    monthly: Math.max(0, monthlyLimit - monthlyUsed),
  };

  if (dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      safeMode: true,
      reason: `Daily ${kind} request limit reached (${dailyLimit}/day). Your project is saved — capacity resets tomorrow.`,
      remaining,
    };
  }

  if (monthlyUsed >= monthlyLimit) {
    return {
      allowed: false,
      safeMode: true,
      reason: `Monthly ${kind} request limit reached (${monthlyLimit}/month). Your project is saved — capacity resets next month.`,
      remaining,
    };
  }

  return { allowed: true, safeMode: false, remaining };
}

/**
 * Records one `kind` request (and optional token count) against the
 * user's daily and monthly usage. Call only after a request has actually
 * been made — checkUsage + recordUsage are two steps, not one, so a
 * caller that decides not to proceed (e.g. validation failed before
 * calling the AI) never burns quota it didn't use.
 */
export async function recordUsage(
  userId: string,
  kind: UsageKind,
  tokens = 0,
): Promise<void> {
  const { daily, monthly } = periodKeys();
  const supabase = createUntypedAdminClient();

  const increments =
    kind === "ai"
      ? { p_ai_requests: 1, p_research_requests: 0, p_tokens: tokens }
      : { p_ai_requests: 0, p_research_requests: 1, p_tokens: tokens };

  const [dailyResult, monthlyResult] = await Promise.all([
    supabase.rpc("increment_usage", {
      p_user_id: userId,
      p_period_type: "daily",
      p_period_key: daily,
      ...increments,
    }),
    supabase.rpc("increment_usage", {
      p_user_id: userId,
      p_period_type: "monthly",
      p_period_key: monthly,
      ...increments,
    }),
  ]);

  if (dailyResult.error) {
    throw new Error(
      `Failed to record daily usage: ${dailyResult.error.message}`,
    );
  }
  if (monthlyResult.error) {
    throw new Error(
      `Failed to record monthly usage: ${monthlyResult.error.message}`,
    );
  }
}
