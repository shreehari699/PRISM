import { afterEach, describe, expect, it, vi } from "vitest";

import { createTimeoutFetch } from "./fetch-with-timeout";

describe("createTimeoutFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("passes through a normal, fast response untouched", async () => {
    const response = new Response("ok", { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(response);

    const timeoutFetch = createTimeoutFetch(5_000);
    const result = await timeoutFetch("https://example.supabase.co/rest/v1/projects");

    expect(result).toBe(response);
  });

  it("aborts and raises a clear, typed timeout error instead of hanging forever — this is the actual fix for a stalled Supabase request never resolving", async () => {
    vi.useFakeTimers();

    // Simulates exactly what a stalled connection to Supabase looks like:
    // the underlying fetch never settles on its own, only in reaction to
    // the AbortController this wrapper is responsible for wiring up.
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const timeoutFetch = createTimeoutFetch(20_000);
    const pending = timeoutFetch("https://example.supabase.co/rest/v1/projects");
    const assertion = expect(pending).rejects.toThrow(/timed out after 20s/);

    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it("still respects a caller-supplied AbortSignal independently of its own timeout", async () => {
    const externalController = new AbortController();
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const timeoutFetch = createTimeoutFetch(60_000);
    const pending = timeoutFetch("https://example.supabase.co/rest/v1/projects", {
      signal: externalController.signal,
    });
    const assertion = expect(pending).rejects.toThrow();

    externalController.abort();
    await assertion;
  });
});
