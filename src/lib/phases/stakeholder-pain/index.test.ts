import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";

import { runStakeholderPainPhase } from "./index";

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

function context() {
  return {
    phaseKey: "stakeholder_pain" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: { problem_intelligence: validProblemAnatomy },
  };
}

function stakeholderOutput(overrides: Record<string, unknown> = {}) {
  return {
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
      {
        localId: "trader",
        name: "Local trader",
        category: "SECONDARY",
        roles: ["BUYER"],
        relationshipToProblem: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
        context: "ctx",
        needs: [],
        decisionPower: "medium",
        influence: "medium",
        urgency: "low",
        impact: "medium",
        evidenceClaims: [],
        confidence: "low",
      },
    ],
    ...overrides,
  };
}

function painOutput(overrides: Record<string, unknown> = {}) {
  return {
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
    secondaryPains: [],
    downstreamConsequences: [],
    customerDistinction: { applicable: true, notes: ["Farmer uses; trader buys."] },
    validationQuestions: ["How frequently does this occur?"],
    realityCheck: {
      stakeholderConfidence: "MODERATE",
      painConfidence: "MODERATE",
      primaryPainConfidence: "MODERATE",
      evidenceCompleteness: "WEAK",
      summary: "n/a",
    },
    consultantMessage: "Interesting split between who uses this and who buys it.",
    ...overrides,
  };
}

function providerWithSequence(results: unknown[]): AiProvider {
  const generateStructured = vi.fn();
  for (const r of results) {
    generateStructured.mockResolvedValueOnce(r);
  }
  return { name: "fake", model: "fake-model", generateStructured };
}

describe("runStakeholderPainPhase", () => {
  it("merges both agents' output and derives painPointIds deterministically", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: stakeholderOutput(), usage: { totalTokens: 100 } },
      { status: "ok", model: "x", data: painOutput(), usage: { totalTokens: 200 } },
    ]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const farmer = result.data.stakeholders.find((s) => s.localId === "farmer");
      const trader = result.data.stakeholders.find((s) => s.localId === "trader");
      expect(farmer?.painPointIds).toEqual(["pain-1"]);
      expect(trader?.painPointIds).toEqual([]);
      expect(result.data.primaryPain.painLocalId).toBe("pain-1");
      expect(result.usage?.totalTokens).toBe(300);
    }
  });

  it("propagates a Stakeholder Analyst failure without calling the Pain Analyst", async () => {
    const provider = providerWithSequence([{ status: "unavailable", reason: "model retired" }]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("unavailable");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("propagates a Pain Analyst failure", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: stakeholderOutput() },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
  });

  it("rejects a pain point that references a stakeholder the analyst never produced", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: stakeholderOutput() },
      {
        status: "ok",
        model: "x",
        data: painOutput({
          painPoints: [
            {
              ...painOutput().painPoints[0],
              stakeholderLocalId: "nonexistent-stakeholder",
            },
          ],
        }),
      },
    ]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown stakeholder/);
    }
  });

  it("rejects a primaryPain that references a pain point that doesn't exist", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: stakeholderOutput() },
      {
        status: "ok",
        model: "x",
        data: painOutput({ primaryPain: { painLocalId: "ghost-pain", reasoning: "n/a" } }),
      },
    ]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown pain point/);
    }
  });

  it("preserves an honest INSUFFICIENT_EVIDENCE reality check rather than upgrading it", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: stakeholderOutput() },
      {
        status: "ok",
        model: "x",
        data: painOutput({
          realityCheck: {
            stakeholderConfidence: "WEAK",
            painConfidence: "INSUFFICIENT_EVIDENCE",
            primaryPainConfidence: "INSUFFICIENT_EVIDENCE",
            evidenceCompleteness: "INSUFFICIENT_EVIDENCE",
            summary: "We could not confidently identify the primary pain.",
          },
        }),
      },
    ]);

    const result = await runStakeholderPainPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.realityCheck.evidenceCompleteness).toBe("INSUFFICIENT_EVIDENCE");
    }
  });
});
