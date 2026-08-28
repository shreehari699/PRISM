import "server-only";

/**
 * Neither `@supabase/supabase-js` nor `@supabase/ssr` impose any timeout
 * of their own on the `fetch` calls they make to PostgREST — every
 * Supabase read and write in this app was, until this file existed,
 * unbounded. A stalled connection (a flaky network hop, a DNS hiccup, a
 * dropped TCP connection that never resets) would hang a phase-engine
 * call indefinitely *before it ever reaches Gemini*, which no AI-provider
 * timeout could catch. This wraps every Supabase client's `fetch` with an
 * `AbortController` so a genuinely stuck request always resolves into a
 * normal, typed error instead of hanging the request forever.
 *
 * 20s is generous for a PostgREST round trip (these normally complete in
 * well under a second) while still bounding the absolute worst case.
 */
const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

export function createTimeoutFetch(
  timeoutMs: number = SUPABASE_REQUEST_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    // A caller-supplied signal (none of ours pass one today, but the
    // Supabase clients might in the future) must still be respected —
    // whichever fires first wins. Only *our* timeout firing should be
    // reported as "timed out" — an external abort is a deliberate
    // cancellation, not a hang, and deserves its own real error.
    let timedOut = false;
    const externalSignal = init?.signal;
    externalSignal?.addEventListener("abort", () => controller.abort());

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut && error instanceof Error && error.name === "AbortError") {
        throw new Error(`Supabase request timed out after ${timeoutMs / 1000}s.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
