import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

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
    const jsonSchema = z.toJSONSchema(params.schema, { target: "draft-7" });

    let responseText: string | undefined;
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

      // Model/timing only — never the prompt, schema, or key.
      console.log(
        JSON.stringify({
          scope: "gemini-provider",
          model: this.model,
          ms: Date.now() - requestStartedAt,
          ok: true,
        }),
      );

      responseText = response.text;

      if (!responseText) {
        const blockReason = response.promptFeedback?.blockReason;
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
      console.log(
        JSON.stringify({
          scope: "gemini-provider",
          model: this.model,
          ms: Date.now() - requestStartedAt,
          ok: false,
        }),
      );

      if (looksLikeTimeout(error)) {
        return {
          status: "error",
          message: `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
        };
      }

      const message = error instanceof Error ? error.message : String(error);

      if (looksLikeModelUnavailable(message)) {
        return {
          status: "unavailable",
          reason: `Configured model "${this.model}" is unavailable: ${message}`,
        };
      }

      return { status: "error", message };
    }
  }
}
