"use client";

/**
 * The browser's installed speech voices, read via `useSyncExternalStore`.
 * `speechSynthesis.getVoices()` returns a new array every call, which
 * would break `useSyncExternalStore` (it expects a stable reference when
 * nothing changed) — this caches one array and only replaces it when the
 * browser actually fires `voiceschanged`.
 */
let cached: SpeechSynthesisVoice[] = [];
let initialized = false;

function refresh(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  cached = window.speechSynthesis.getVoices();
}

export function subscribeAvailableVoices(listener: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  if (!initialized) {
    initialized = true;
    refresh();
  }
  const handler = () => {
    refresh();
    listener();
  };
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

export function getAvailableVoicesSnapshot(): SpeechSynthesisVoice[] {
  if (!initialized && typeof window !== "undefined" && "speechSynthesis" in window) {
    initialized = true;
    refresh();
  }
  return cached;
}

export function getAvailableVoicesServerSnapshot(): SpeechSynthesisVoice[] {
  return [];
}
