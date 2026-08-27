"use client";

/**
 * External store for "has the intro already played on this browser" —
 * read via `useSyncExternalStore` for the same hydration-safety reason as
 * `theme-store.ts`: a mount-time localStorage read that flips visibility
 * must not be a synchronous `setState` inside an effect.
 */
const STORAGE_KEY = "prism-intro-seen";
const listeners = new Set<() => void>();

export function subscribeIntroSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getIntroSeenSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Server (and pre-hydration client) render assumes unseen; the real check happens client-side only. */
export function getIntroSeenServerSnapshot(): boolean {
  return true;
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Nothing to do — the intro will simply reappear next load.
  }
  for (const listener of listeners) listener();
}
