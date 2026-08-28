"use client";

/**
 * Tracks, per investigation and per phase, whether that phase's "opening"
 * narration has already played. Mirrors `welcome-narration-store.ts`'s
 * localStorage pattern for the same reason: without it, every mount (a
 * refresh, navigating back) would replay the phase-open line on top of
 * whatever the user is already looking at, instead of only speaking it
 * the first time this phase is actually opened in this investigation.
 */
const STORAGE_KEY_PREFIX = "prism-phase-open-narrated:";

export function hasPhaseOpenNarrationPlayed(investigationId: string, phaseKey: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + investigationId + ":" + phaseKey) === "true";
  } catch {
    return false;
  }
}

export function markPhaseOpenNarrationPlayed(investigationId: string, phaseKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + investigationId + ":" + phaseKey, "true");
  } catch {
    // Worst case the line replays once more on a future refresh.
  }
}
