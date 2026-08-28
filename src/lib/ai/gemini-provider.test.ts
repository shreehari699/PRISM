import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContentMock = vi.fn();

class MockApiError extends Error {
  status: number;
  constructor(info: { message: string; status: number }) {
    super(info.message);
    this.status = info.status;
  }
}

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
  ApiError: MockApiError,
}));

const { GeminiProvider } = await import("./gemini-provider");

const schema = z.object({
  problemSummary: z.string(),
  severity: z.number().min(0).max(100),
});

describe("GeminiProvider.generateStructured", () => {
  afterEach(() => {
    generateContentMock.mockReset();
  });

  it("returns validated data on a well-formed response", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ problemSummary: "Farmers lack pricing data.", severity: 72 }),
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        totalTokenCount: 140,
      },
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "You are the Problem Analyst.",
      prompt: "Analyze this problem.",
      schema,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.severity).toBe(72);
      expect(result.usage?.totalTokens).toBe(140);
    }
  });

  it("returns invalid_output when the model response is not JSON", async () => {
    generateContentMock.mockResolvedValue({ text: "not json at all" });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("invalid_output");
  });

  it("returns invalid_output when JSON doesn't match the schema (never trusts raw model JSON)", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ problemSummary: "ok", severity: "way too high" }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("invalid_output");
  });

  it("returns unavailable when the configured model doesn't exist", async () => {
    generateContentMock.mockRejectedValue(
      new Error("404 Not Found: model gemini-99-ultra is not found"),
    );

    const provider = new GeminiProvider("test-key", "gemini-99-ultra");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("unavailable");
  });

  it("returns error for other failures instead of throwing", async () => {
    generateContentMock.mockRejectedValue(new Error("quota exceeded"));

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("error");
  });

  it("bounds every request's thinking budget, so a reasoning-heavy model can't spend unbounded time 'thinking' before ever producing output", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ problemSummary: "ok", severity: 10 }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    const [[call]] = generateContentMock.mock.calls;
    expect(call.config.thinkingConfig?.thinkingBudget).toEqual(expect.any(Number));
    expect(call.config.thinkingConfig.thinkingBudget).toBeGreaterThan(0);
  });

  it("bounds every request with an explicit HTTP timeout, so a hung backend can never leave a phase running forever", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ problemSummary: "ok", severity: 10 }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    const [[call]] = generateContentMock.mock.calls;
    expect(call.config.httpOptions?.timeout).toEqual(expect.any(Number));
    expect(call.config.httpOptions.timeout).toBeGreaterThan(0);
  });

  it("returns a distinct timeout error (never 'unavailable') once retries are exhausted", async () => {
    vi.useFakeTimers();
    try {
      const abortError = new Error("The operation timed out.");
      abortError.name = "AbortError";
      generateContentMock.mockRejectedValue(abortError);

      const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
      const resultPromise = provider.generateStructured({
        systemInstruction: "sys",
        prompt: "prompt",
        schema,
      });

      // A timeout is retried like any other transient failure — flush
      // both backoff delays between the 3 attempts.
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toMatch(/timed out/i);
        expect(result.message).toMatch(/3 attempt/i);
      }
      expect(generateContentMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a 503 and succeeds once the provider recovers, without ever surfacing the transient failure to the caller", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock
        .mockRejectedValueOnce(
          new MockApiError({
            status: 503,
            message: "The model is currently experiencing high demand.",
          }),
        )
        .mockResolvedValueOnce({
          text: JSON.stringify({ problemSummary: "ok", severity: 40 }),
        });

      const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
      const resultPromise = provider.generateStructured({
        systemInstruction: "sys",
        prompt: "prompt",
        schema,
      });

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.status).toBe("ok");
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exhausts retries on a persistent 503 and returns a clean, human-readable message — never the raw provider error body", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockRejectedValue(
        new MockApiError({
          status: 503,
          message:
            '{"error":{"code":503,"message":"The model is currently experiencing high demand. Spikes in demand are usually temporary.","status":"UNAVAILABLE"}}',
        }),
      );

      const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
      const resultPromise = provider.generateStructured({
        systemInstruction: "sys",
        prompt: "prompt",
        schema,
      });

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(generateContentMock).toHaveBeenCalledTimes(3);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toMatch(/temporarily unavailable/i);
        expect(result.reason).toMatch(/3 attempts/);
        expect(result.reason).not.toContain("{");
        expect(result.reason).not.toContain("UNAVAILABLE");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("never retries a non-retryable status like 401 — retrying an auth failure identically would only waste time", async () => {
    generateContentMock.mockRejectedValue(
      new MockApiError({ status: 401, message: "API key not valid." }),
    );

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
  });

  it("injects a real enum constraint into every sourceIds field in the JSON schema sent to Gemini when sourceIdVocabulary is given", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        problemSummary: "ok",
        severity: 10,
        claim: { claim: "x", status: "INFERENCE", sourceIds: ["source-1"], confidence: "medium", reasoning: "y" },
      }),
    });

    const nestedSchema = z.object({
      problemSummary: z.string(),
      severity: z.number().min(0).max(100),
      claim: z.object({
        claim: z.string(),
        status: z.string(),
        sourceIds: z.array(z.string()).default([]),
        confidence: z.string(),
        reasoning: z.string(),
      }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema: nestedSchema,
      sourceIdVocabulary: ["source-1", "source-2"],
    });

    const [[call]] = generateContentMock.mock.calls;
    const sentJsonSchema = call.config.responseJsonSchema;
    expect(sentJsonSchema.properties.claim.properties.sourceIds.items.enum).toEqual([
      "source-1",
      "source-2",
    ]);
  });

  it("forces sourceIds to maxItems 0 in the sent schema when the vocabulary is empty", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ problemSummary: "ok", severity: 10 }) });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema: z.object({
        problemSummary: z.string(),
        severity: z.number(),
        sourceIds: z.array(z.string()).default([]),
      }),
      sourceIdVocabulary: [],
    });

    const [[call]] = generateContentMock.mock.calls;
    expect(call.config.responseJsonSchema.properties.sourceIds.maxItems).toBe(0);
  });

  it("does not touch the JSON schema at all when sourceIdVocabulary is omitted", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ problemSummary: "ok", severity: 10 }) });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.generateStructured({ systemInstruction: "sys", prompt: "prompt", schema });

    const [[call]] = generateContentMock.mock.calls;
    expect(call.config.responseJsonSchema).toEqual(z.toJSONSchema(schema, { target: "draft-7" }));
  });

  // The literal production bug, reproduced at the provider level: a gap
  // id cited in a sourceIds field must be rejected even if it somehow
  // slipped past the generation-time constraint above — Gemini's schema
  // adherence isn't a guarantee, so this is the real backstop.
  it("rejects a response citing a sourceId outside the given vocabulary — the actual GAP-001 production bug", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        problemSummary: "ok",
        severity: 10,
        claim: { claim: "x", status: "INFERENCE", sourceIds: ["GAP-01"], confidence: "medium", reasoning: "y" },
      }),
    });

    const nestedSchema = z.object({
      problemSummary: z.string(),
      severity: z.number(),
      claim: z.object({
        claim: z.string(),
        status: z.string(),
        sourceIds: z.array(z.string()).default([]),
        confidence: z.string(),
        reasoning: z.string(),
      }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema: nestedSchema,
      sourceIdVocabulary: ["source-1"],
    });

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source id "GAP-01"/);
    }
  });

  it("accepts a response whose sourceIds are all in the vocabulary", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ problemSummary: "ok", severity: 10, sourceIds: ["source-1"] }),
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema: z.object({
        problemSummary: z.string(),
        severity: z.number(),
        sourceIds: z.array(z.string()).default([]),
      }),
      sourceIdVocabulary: ["source-1"],
    });

    expect(result.status).toBe("ok");
  });

  it("reports a blocked prompt as an error rather than an empty success", async () => {
    generateContentMock.mockResolvedValue({
      text: undefined,
      promptFeedback: { blockReason: "SAFETY" },
    });

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/SAFETY/);
    }
  });
});
