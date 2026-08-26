import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
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

    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
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

    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
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

    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
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

    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
    const result = await provider.generateStructured({
      systemInstruction: "sys",
      prompt: "prompt",
      schema,
    });

    expect(result.status).toBe("error");
  });

  it("reports a blocked prompt as an error rather than an empty success", async () => {
    generateContentMock.mockResolvedValue({
      text: undefined,
      promptFeedback: { blockReason: "SAFETY" },
    });

    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
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
