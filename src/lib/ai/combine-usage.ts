import type { AiUsage } from "./types";

/**
 * Sums token usage across however many internal AiProvider calls a
 * multi-agent phase made, so the phase engine's `recordUsage` still
 * charges exactly one AI request per phase run with an accurate total —
 * first used by Phase 02 (2 calls), reused by Phase 03 (2 calls), and
 * meant for any future phase that composes more than one agent call.
 */
export function combineUsage(...usages: (AiUsage | undefined)[]): AiUsage | undefined {
  const defined = usages.filter((usage): usage is AiUsage => usage !== undefined);
  if (defined.length === 0) return undefined;

  return {
    promptTokens: defined.reduce((sum, u) => sum + (u.promptTokens ?? 0), 0),
    responseTokens: defined.reduce((sum, u) => sum + (u.responseTokens ?? 0), 0),
    totalTokens: defined.reduce((sum, u) => sum + (u.totalTokens ?? 0), 0),
  };
}
