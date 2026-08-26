import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";

import { runStakeholderAnalyst } from "./index";
import { stakeholderAnalystOutputSchema } from "./schema";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

const validProblemAnatomy: ProblemAnatomy = {
  restatement: "Smallholder farmers lack real-time crop pricing.",
  who: [{ group: "Farmers", description: "Affected group" }],
  what: { claim: "x", status: "INFERENCE", reasoning: "y" },
  where: { claim: "x", status: "INFERENCE", reasoning: "y" },
  when: { claim: "x", status: "INFERENCE", reasoning: "y" },
  why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
  assumptions: [],
  openQuestions: [],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
};

const validStakeholderOutput = {
  stakeholders: [
    {
      localId: "farmer",
      name: "Smallholder farmer",
      category: "PRIMARY",
      roles: ["USER"],
      relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
      context: "ctx",
      needs: [],
      decisionPower: "none",
      influence: "low",
      urgency: "high",
      impact: "high",
      evidenceClaims: [],
      confidence: "medium",
    },
  ],
};

function context(upstream: unknown) {
  return {
    phaseKey: "stakeholder_pain" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: { problem_intelligence: upstream },
  };
}

describe("runStakeholderAnalyst", () => {
  it("returns an error without calling the provider when Phase 01 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validStakeholderOutput });

    const result = await runStakeholderAnalyst(context(undefined), provider);

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error when Phase 01 output doesn't match the expected shape", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validStakeholderOutput });

    const result = await runStakeholderAnalyst(
      context({ not: "a valid problem anatomy" }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with the stakeholder schema when Phase 01 output is valid", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validStakeholderOutput });

    const result = await runStakeholderAnalyst(context(validProblemAnatomy), provider);

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: stakeholderAnalystOutputSchema }),
    );
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.prompt).toContain("Smallholder farmers lack real-time crop pricing.");
  });
});
