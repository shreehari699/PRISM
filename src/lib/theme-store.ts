"use client";

/**
 * A minimal external store for the light/dark theme, read via
 * `useSyncExternalStore` rather than an effect-driven `useState` — the
 * theme is genuinely external state (a DOM class + localStorage), and
 * `useSyncExternalStore` is what lets a mount-time read stay hydration-safe
 * without a "set state synchronously in an effect" anti-pattern.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "prism-theme";
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** PRISM is dark-first: the server (and any pre-hydration client render) always assumes dark. */
export function getThemeServerSnapshot(): Theme {
  return "dark";
}

export function setTheme(next: Theme): void {
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage may be unavailable (private browsing); the DOM class still updates for this page load.
  }
  for (const listener of listeners) listener();
}
