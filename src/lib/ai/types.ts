import type { z } from "zod";

export interface AiGenerateParams<T> {
  /** High-level agent role/persona instructions (see src/lib/ai/agents). */
  systemInstruction: string;
  /** The actual task prompt, including any upstream phase context. */
  prompt: string;
  /** Every structured call must declare and validate its output shape. */
  schema: z.ZodType<T>;
  temperature?: number;
  /**
   * The real, complete set of source ids valid for every `sourceIds`
   * field in `schema`, wherever it appears — a provider that supports it
   * uses this to constrain generation itself (see
   * `constrainSourceIdsInJsonSchema`) and to reject a response that
   * cites an id outside it before `schema` even parses the value. Omit
   * when the call's schema has no `sourceIds` field to constrain.
   */
  sourceIdVocabulary?: readonly string[];
}

export interface AiUsage {
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
}

/**
 * Discriminated union so every call site is forced to handle the model
 * being unavailable or returning invalid output — PRISM must never
 * silently substitute a fake response for a genuine failure.
 */
export type AiResult<T> =
  | { status: "ok"; data: T; model: string; usage?: AiUsage }
  | { status: "unavailable"; reason: string }
  | { status: "invalid_output"; message: string; raw: string }
  | { status: "error"; message: string }
  /**
   * Distinct from generic "unavailable" 5xx failures: the provider
   * explicitly returned HTTP 429 and stayed rate-limited through every
   * bounded retry. `retryAfterMs` is set only when the provider itself
   * supplied a retry delay (never a guessed/invented value) — callers
   * that can honor it (e.g. a client-side retry cooldown) should prefer
   * it over their own default backoff.
   */
  | { status: "rate_limited"; message: string; retryAfterMs?: number };

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T>(params: AiGenerateParams<T>): Promise<AiResult<T>>;
}
