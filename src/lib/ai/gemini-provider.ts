import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { constrainSourceIdsInJsonSchema, findUnknownCitedSourceId } from "./source-id-vocabulary";
import type { AiGenerateParams, AiProvider, AiResult } from "./types";

/**
 * Errors from a bad/retired model id look like generic 404s from the
 * Gemini API. We match on message content because the SDK doesn't expose
 * a distinct error class for "model unavailable" vs. other 4xx errors —
 * this is what lets the app fail gracefully (safe "unavailable" state)
 * instead of a raw 500 when GEMINI_MODEL is misconfigured or deprecated.
 */
function looksLikeModelUnavailable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("404") || lower.includes("not found")) &&
    lower.includes("model")
  );
}

/**
 * The SDK has no default request timeout of its own — an unresponsive
 * Gemini backend would otherwise hang this call (and the phase-run HTTP
 * request awaiting it) indefinitely, leaving the UI stuck on
 * "Investigating..." forever. 120s is generous enough for a large
 * structured-output response with extended thinking (observed real
 * calls complete in well under 30s) while still guaranteeing the phase
 * engine always reaches a terminal `failed` state instead of hanging.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * A live diagnostic call against the real configured model
 * (gemini-3.7-flash) with the actual Problem Analyst schema — not a toy
 * prompt — ran for the full 120s timeout above and never returned so
 * much as a partial response. The trivial "reply with two fields" smoke
 * test from an earlier session returned in ~2s but reported 139 hidden
 * "thinking" tokens against a 26-token prompt: a >5x thinking-to-prompt
 * ratio. Left on its API default ("AUTOMATIC" budget, i.e. the model
 * decides how much to think), a model that reasons that heavily can
 * spend an unbounded amount of time reasoning over a large, real
 * structured-output schema before ever emitting output — this is far
 * more consistent with the hang than a network stall would be, since a
 * genuinely stuck connection fails fast on the proxy in this
 * environment, not silently for two minutes straight.
 *
 * Explicitly bounding the thinking budget (rather than disabling
 * thinking outright, which would blunt the analysis quality PRISM's
 * value depends on) keeps generation time predictable without
 * sacrificing reasoning depth for a phase this size.
 */
const THINKING_BUDGET_TOKENS = 8192;

function looksLikeTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /deadline|timeout/i.test(error.message))
  );
}

/**
 * A real Phase 02 run hit this directly: Gemini returned
 * `503 UNAVAILABLE — "currently experiencing high demand"`. That, 429,
 * and 500/502/504 are all conditions where the *same request* is likely
 * to succeed moments later — worth a few bounded retries. A 400/401/403
 * or 404 means the request or configuration itself is wrong; retrying
 * identically would just fail identically three times slower.
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/**
 * A provider-supplied retry delay is honored, but never unbounded — a
 * malformed or unusually large `retryDelay` must not stall a phase run
 * past what the dashboard's own timeout (8 minutes) and this provider's
 * per-attempt timeout (120s × up to 3 attempts) can absorb. 20s keeps
 * three attempts' worth of 429 backoff comfortably inside that budget.
 */
const MAX_RATE_LIMIT_BACKOFF_MS = 20_000;

interface ErrorClassification {
  retryable: boolean;
  status?: number;
  /** True only for an actual HTTP 429 — distinct from other retryable 5xx statuses. */
  rateLimited?: boolean;
}

function classifyGenerateError(error: unknown): ErrorClassification {
  if (error instanceof ApiError) {
    return {
      retryable: RETRYABLE_STATUS_CODES.has(error.status),
      status: error.status,
      rateLimited: error.status === 429,
    };
  }
  if (looksLikeTimeout(error)) {
    return { retryable: true };
  }
  if (
    error instanceof Error &&
    /network|fetch failed|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT/i.test(error.message)
  ) {
    return { retryable: true };
  }
  return { retryable: false };
}

/**
 * Reads a provider-supplied retry delay out of a 429's error body —
 * never invented when absent. Google's API nests a `RetryInfo` proto
 * detail (`{"retryDelay":"19s"}`) inside the JSON error envelope the SDK
 * puts in `error.message`; this looks for it there first, then falls
 * back to a loose regex match in case the envelope isn't full JSON (the
 * SDK doesn't guarantee one shape across every failure path).
 */
function extractProviderRetryDelayMs(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;

  const parseSeconds = (raw: string): number | undefined => {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(raw);
    return match ? Math.round(parseFloat(match[1]) * 1000) : undefined;
  };

  try {
    const parsed: unknown = JSON.parse(error.message);
    const details = (parsed as { error?: { details?: unknown[] } })?.error?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        const retryDelay = (detail as { retryDelay?: unknown })?.retryDelay;
        if (typeof retryDelay === "string") {
          const ms = parseSeconds(retryDelay);
          if (ms !== undefined) return ms;
        }
      }
    }
  } catch {
    // error.message wasn't a JSON envelope — fall through to the regex.
  }

  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?s)"/.exec(error.message);
  return match ? parseSeconds(match[1]) : undefined;
}

/**
 * Exponential backoff with jitter: attempt 1's failure waits ~1-2s
 * before attempt 2, attempt 2's failure waits ~2-4s before attempt 3.
 * Jitter avoids every concurrent request retrying in lockstep against
 * an already-overloaded backend. For a 429 specifically, a real
 * provider-supplied retry delay (bounded) is preferred over this guess.
 */
function backoffDelayMs(attemptNumber: number, rateLimitError?: unknown): number {
  if (rateLimitError !== undefined) {
    const providerDelay = extractProviderRetryDelayMs(rateLimitError);
    if (providerDelay !== undefined) {
      return Math.min(providerDelay, MAX_RATE_LIMIT_BACKOFF_MS);
    }
  }
  const base = 1000 * 2 ** (attemptNumber - 1);
  const jitter = base * (0.5 + Math.random() * 0.5);
  return Math.round(base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateStructured<T>(
    params: AiGenerateParams<T>,
  ): Promise<AiResult<T>> {
    const baseJsonSchema = z.toJSONSchema(params.schema, { target: "draft-7" });
    const jsonSchema = params.sourceIdVocabulary
      ? constrainSourceIdsInJsonSchema(baseJsonSchema, params.sourceIdVocabulary)
      : baseJsonSchema;

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const requestStartedAt = Date.now();

      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            temperature: params.temperature ?? 0.4,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            httpOptions: { timeout: REQUEST_TIMEOUT_MS },
            thinkingConfig: { thinkingBudget: THINKING_BUDGET_TOKENS },
          },
        });

        // Model/timing/attempt only — never the prompt, schema, or key.
        console.log(
          JSON.stringify({
            scope: "gemini-provider",
            model: this.model,
            attempt,
            maxAttempts: MAX_ATTEMPTS,
            ms: Date.now() - requestStartedAt,
            ok: true,
          }),
        );

        const responseText = response.text;

        if (!responseText) {
          const blockReason = response.promptFeedback?.blockReason;
          // A blocked/empty response is deterministic for this input —
          // retrying the identical request won't change the outcome.
          return {
            status: "error",
            message: blockReason
              ? `Gemini blocked the response (${blockReason}).`
              : "Gemini returned an empty response.",
          };
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(responseText);
        } catch {
          return {
            status: "invalid_output",
            message: "Gemini response was not valid JSON.",
            raw: responseText,
          };
        }

        // The generation-time `enum` constraint above isn't a guarantee —
        // still check the actual returned value against the real
        // vocabulary before anything downstream (including the schema
        // parse below) ever sees it.
        if (params.sourceIdVocabulary) {
          const unknownId = findUnknownCitedSourceId(parsedJson, params.sourceIdVocabulary);
          if (unknownId) {
            return {
              status: "invalid_output",
              message: `Gemini output cited unknown source id "${unknownId}" — not in the real research source list for this call.`,
              raw: responseText,
            };
          }
        }

        // Never trust raw model JSON — always re-validate against the
        // schema the caller actually needs, even though we asked the model
        // to conform to it.
        const validated = params.schema.safeParse(parsedJson);
        if (!validated.success) {
          return {
            status: "invalid_output",
            message: `Gemini output failed schema validation: ${validated.error.message}`,
            raw: responseText,
          };
        }

        return {
          status: "ok",
          data: validated.data,
          model: this.model,
          usage: response.usageMetadata
            ? {
                promptTokens: response.usageMetadata.promptTokenCount,
                responseTokens: response.usageMetadata.candidatesTokenCount,
                totalTokens: response.usageMetadata.totalTokenCount,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error;
        const classification = classifyGenerateError(error);

        console.log(
          JSON.stringify({
            scope: "gemini-provider",
            model: this.model,
            attempt,
            maxAttempts: MAX_ATTEMPTS,
            ms: Date.now() - requestStartedAt,
            ok: false,
            status: classification.status,
            retryable: classification.retryable,
            rateLimited: classification.rateLimited,
          }),
        );

        const message = error instanceof Error ? error.message : String(error);
        if (looksLikeModelUnavailable(message)) {
          // A wrong/retired model id will never succeed on retry.
          return {
            status: "unavailable",
            reason: `Configured model "${this.model}" is unavailable: ${message}`,
          };
        }

        if (!classification.retryable || attempt === MAX_ATTEMPTS) {
          break;
        }

        await sleep(backoffDelayMs(attempt, classification.rateLimited ? error : undefined));
      }
    }

    return this.finalFailureResult(lastError);
  }

  /**
   * Reached only once every retry attempt is exhausted. Builds a clean,
   * human-readable message — never the SDK's raw error body — so the UI
   * never has to render a JSON blob as the primary failure experience.
   * Never returns an "ok"/"invalid_output" variant, so this is safely
   * assignable to `AiResult<T>` for whatever `T` the caller needs
   * without itself being generic.
   */
  private finalFailureResult(
    error: unknown,
  ):
    | { status: "error"; message: string }
    | { status: "unavailable"; reason: string }
    | { status: "rate_limited"; message: string; retryAfterMs?: number } {
    if (looksLikeTimeout(error)) {
      return {
        status: "error",
        message: `Gemini request timed out after ${MAX_ATTEMPTS} attempt(s) (${REQUEST_TIMEOUT_MS / 1000}s each).`,
      };
    }

    const classification = classifyGenerateError(error);
    if (classification.rateLimited) {
      return {
        status: "rate_limited",
        message: `Gemini is rate-limited (HTTP 429) after ${MAX_ATTEMPTS} attempts.`,
        retryAfterMs: extractProviderRetryDelayMs(error),
      };
    }
    if (classification.retryable) {
      return {
        status: "unavailable",
        reason: `Gemini is temporarily unavailable after ${MAX_ATTEMPTS} attempts (provider returned HTTP ${classification.status ?? "an error"}). Please retry.`,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}
