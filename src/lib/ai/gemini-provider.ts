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

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });

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
