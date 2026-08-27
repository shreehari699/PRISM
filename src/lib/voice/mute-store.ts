"use client";

/**
 * External store for the voice consultant's mute state — mirrors
 * `theme-store.ts`. Muting is genuinely external (localStorage-backed)
 * state, so it's read via `useSyncExternalStore` rather than an
 * effect-driven `useState`.
 */
const STORAGE_KEY = "prism-voice-muted";
const listeners = new Set<() => void>();

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMutedSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Default to muted before hydration — the safer, non-surprising choice. */
export function getMutedServerSnapshot(): boolean {
  return true;
}

export function setMuted(next: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Ignore — the in-memory snapshot still updates for this session.
  }
  for (const listener of listeners) listener();
}

export function subscribeSpeechSupport(): () => void {
  return () => {};
}

export function getSpeechSupportSnapshot(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getSpeechSupportServerSnapshot(): boolean {
  return false;
}
