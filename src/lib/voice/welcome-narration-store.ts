"use client";

/**
 * Tracks, per investigation, whether its welcome narration has already
 * played. Without this, every mount of `InvestigationDashboard` — which
 * includes every browser refresh, not just genuine first-time entry —
 * replayed the generic welcome narration, drowning out whatever phase
 * the user actually had open. A plain in-component `useRef` guard only
 * survives one mount; this survives the remount a refresh causes.
 *
 * Mirrors the `intro-store.ts` localStorage pattern, keyed per
 * investigation rather than globally, since "welcome" here means
 * "welcome to this specific investigation," not "welcome to PRISM."
 */
const STORAGE_KEY_PREFIX = "prism-welcome-narrated:";

export function hasWelcomeNarrationPlayed(investigationId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + investigationId) === "true";
  } catch {
    // If storage is unavailable, err toward not re-narrating on every
    // render within this session — the caller's own ref guard still
    // prevents duplicate calls within one mount.
    return false;
  }
}

export function markWelcomeNarrationPlayed(investigationId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + investigationId, "true");
  } catch {
    // Nothing to do — worst case the welcome narration replays once
    // more on a future refresh, which is the pre-existing behavior.
  }
}
