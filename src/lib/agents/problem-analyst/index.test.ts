import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";

import { runProblemAnalyst } from "./index";
import { problemAnatomySchema } from "./schema";

function fakeProvider(result: Awaited<ReturnType<AiProvider["generateStructured"]>>): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

const context = {
  phaseKey: "problem_intelligence" as const,
  mode: "HACKATHON" as const,
  criteria: ["demo_feasibility"],
  problemStatement: "Farmers lack access to real-time crop pricing.",
  upstreamOutputs: {},
};

describe("runProblemAnalyst", () => {
  it("passes the problem anatomy schema and a low temperature to the provider", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "fake-model",
      data: {
        restatement: "ok",
        who: [{ group: "Farmers", description: "Affected group" }],
        what: { claim: "x", status: "INFERENCE", reasoning: "y" },
        where: { claim: "x", status: "INFERENCE", reasoning: "y" },
        when: { claim: "x", status: "INFERENCE", reasoning: "y" },
        why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
        assumptions: [],
        openQuestions: [],
        clarity: { isWellDefined: true, issues: [] },
        problemScore: {
          value: 50,
          basis: "ai_estimate",
          reasoning: "n/a",
          confidence: "low",
        },
      },
    });

    await runProblemAnalyst(context, provider);

    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: problemAnatomySchema,
        temperature: 0.3,
      }),
    );
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.prompt).toContain("Farmers lack access to real-time crop pricing.");
    expect(call.systemInstruction).toMatch(/Problem Analyst/);
  });

  it("never lets a VERIFIED evidence claim through as a successful result — Phase 01 has no research tool to back one", async () => {
    // A real (not merely mocked-away) schema failure: the provider isn't
    // stubbed to return `invalid_output` — it returns "ok" with data that
    // violates problemAnatomySchema's own VERIFIED guard, exercising the
    // actual Zod validation this test would otherwise assume works.
    const { problemAnatomySchema } = await import("./schema");
    const taintedData = {
      restatement: "ok",
      who: [{ group: "Farmers", description: "Affected group" }],
      what: { claim: "x", status: "VERIFIED", reasoning: "y" },
      where: { claim: "x", status: "INFERENCE", reasoning: "y" },
      when: { claim: "x", status: "INFERENCE", reasoning: "y" },
      why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
      assumptions: [],
      openQuestions: [],
      clarity: { isWellDefined: true, issues: [] },
      problemScore: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    };

    expect(problemAnatomySchema.safeParse(taintedData).success).toBe(false);

    // The real GeminiProvider would have caught this itself (it re-validates
    // raw model JSON against the schema before ever returning "ok") — a fake
    // provider that skipped that step is exactly the failure mode being
    // guarded against, so runProblemAnalyst must not be the safety net here;
    // the schema is. This asserts the schema, not the fake, is what protects
    // production.
    const provider = fakeProvider({
      status: "invalid_output",
      message: "Gemini output failed schema validation",
      raw: JSON.stringify(taintedData),
    });
    const result = await runProblemAnalyst(context, provider);
    expect(result.status).toBe("invalid_output");
  });

  it("passes through a failure result without modification", async () => {
    const provider = fakeProvider({
      status: "unavailable",
      reason: "model retired",
    });

    const result = await runProblemAnalyst(context, provider);
    expect(result.status).toBe("unavailable");
  });
});
