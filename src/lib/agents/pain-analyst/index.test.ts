import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { DraftStakeholder } from "@/lib/agents/stakeholder-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";

import { runPainAnalyst } from "./index";
import { painAnalystOutputSchema } from "./schema";

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

const stakeholders: DraftStakeholder[] = [
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
];

const validOutput = {
  painPoints: [
    {
      localId: "pain-1",
      stakeholderLocalId: "farmer",
      painTitle: "No price visibility",
      description: "d",
      cause: { claim: "x", status: "INFERENCE", reasoning: "y" },
      frequency: { claim: "x", status: "UNKNOWN", reasoning: "y" },
      riskIfUnsolved: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
      severityScore: {
        dimensions: {
          severity: 70,
          frequency: 50,
          reach: 40,
          consequence: 60,
          urgency: 55,
          currentSolutionSatisfaction: 20,
        },
        overall: { value: 58, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      },
      confidence: "medium",
    },
  ],
  primaryPain: { painLocalId: "pain-1", reasoning: "Root cause, not a symptom." },
  customerDistinction: { applicable: false, notes: [] },
  validationQuestions: ["How frequently does this occur?"],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "Interesting — the pain is real but frequency is still unknown.",
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

describe("runPainAnalyst", () => {
  it("returns an error without calling the provider when Phase 01 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runPainAnalyst(context(undefined), stakeholders, provider);

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with the pain schema and embeds the stakeholder list", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runPainAnalyst(
      context(validProblemAnatomy),
      stakeholders,
      provider,
    );

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: painAnalystOutputSchema }),
    );
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.prompt).toContain("[farmer]");
  });
});
