import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runExistingSolutionAgent } from "./index";
import { solutionExtractorOutputSchema } from "./schema";

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

const validStakeholderPain: StakeholderPainAnalysis = {
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
      painPointIds: ["pain-1"],
    },
  ],
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
      evidenceClaims: [],
    },
  ],
  primaryPain: { painLocalId: "pain-1", reasoning: "Root cause, not a symptom." },
  secondaryPains: [],
  downstreamConsequences: [],
  customerDistinction: { applicable: false, notes: [] },
  validationQuestions: ["How frequently does this occur?"],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "n/a",
};

const source: PhaseSource = {
  title: "eNAM",
  url: "https://enam.gov.in",
  sourceType: "government",
  retrievedAt: new Date().toISOString(),
  snippet: "A national electronic trading platform.",
  sourceLocalId: "source-1",
  query: "government crop pricing platform",
  category: "GOVERNMENT",
};

const validOutput = {
  solutions: [],
  consultantMessage: "No credible existing solutions surfaced in this batch.",
};

function context(upstream: {
  problemIntelligence?: unknown;
  stakeholderPain?: unknown;
}) {
  return {
    phaseKey: "existing_solutions" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: upstream.problemIntelligence,
      stakeholder_pain: upstream.stakeholderPain,
    },
    userId: "user-1",
  };
}

const researchSummary = { queriesExecuted: 1, researchFailures: 0, budgetExhausted: false };

describe("runExistingSolutionAgent", () => {
  it("returns an error without calling the provider when Phase 01 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runExistingSolutionAgent(
      context({ stakeholderPain: validStakeholderPain }),
      [source],
      researchSummary,
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 02 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runExistingSolutionAgent(
      context({ problemIntelligence: validProblemAnatomy }),
      [source],
      researchSummary,
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with the solution extractor schema and embeds sources", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runExistingSolutionAgent(
      context({
        problemIntelligence: validProblemAnatomy,
        stakeholderPain: validStakeholderPain,
      }),
      [source],
      researchSummary,
      provider,
    );

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: solutionExtractorOutputSchema }),
    );
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.prompt).toContain("[source-1]");
  });
});
