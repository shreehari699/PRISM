import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { ResearchProvider, ResearchResult } from "@/lib/research";

const checkUsageMock = vi.fn();
const recordUsageMock = vi.fn();

vi.mock("@/lib/usage", () => ({
  checkUsage: (...args: unknown[]) => checkUsageMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

const { runResearchAgent } = await import("./index");

function fakeAiProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

function fakeResearchProvider(responses: ResearchResult[]): ResearchProvider {
  const search = vi.fn();
  for (const response of responses) search.mockResolvedValueOnce(response);
  return { name: "fake", isConfigured: true, search };
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

function context(options: { userId?: string } = {}) {
  return {
    phaseKey: "existing_solutions" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy,
      stakeholder_pain: validStakeholderPain,
    },
    userId: "userId" in options ? options.userId : "user-1",
  };
}

const validQuestionOutput = {
  queries: [
    {
      query: "government crop pricing platform India",
      category: "GOVERNMENT",
      reason: "r",
      targetInformation: "t",
    },
  ],
};

beforeEach(() => {
  checkUsageMock.mockReset();
  recordUsageMock.mockReset();
  checkUsageMock.mockResolvedValue({
    allowed: true,
    safeMode: false,
    remaining: { daily: 10, monthly: 100 },
  });
  recordUsageMock.mockResolvedValue(undefined);
});

describe("runResearchAgent", () => {
  it("returns an error when context has no userId", async () => {
    const aiProvider = fakeAiProvider({ status: "ok", model: "x", data: validQuestionOutput });
    const researchProvider = fakeResearchProvider([]);

    const result = await runResearchAgent(context({ userId: undefined }), aiProvider, researchProvider);

    expect(result.status).toBe("error");
    expect(checkUsageMock).not.toHaveBeenCalled();
  });

  it("reports budgetExhausted as an ok, non-fabricated result when research usage is exhausted", async () => {
    checkUsageMock.mockResolvedValue({
      allowed: false,
      safeMode: true,
      reason: "Daily research request limit reached (30/day).",
      remaining: { daily: 0, monthly: 5 },
    });
    const aiProvider = fakeAiProvider({ status: "ok", model: "x", data: validQuestionOutput });
    const researchProvider = fakeResearchProvider([]);

    const result = await runResearchAgent(context({}), aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok" && result.budgetExhausted) {
      expect(result.sources).toEqual([]);
      expect(result.reason).toMatch(/Daily research request limit reached/);
    } else {
      throw new Error("expected budgetExhausted result");
    }
    expect(aiProvider.generateStructured).not.toHaveBeenCalled();
    expect(researchProvider.search).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it("runs the full pipeline and records research usage exactly once", async () => {
    const aiProvider = fakeAiProvider({ status: "ok", model: "x", data: validQuestionOutput });
    const researchProvider = fakeResearchProvider([
      {
        status: "ok",
        provider: "tavily",
        sources: [
          {
            title: "eNAM",
            url: "https://enam.gov.in",
            sourceType: "government",
            retrievedAt: new Date().toISOString(),
            snippet: "A government platform.",
          },
        ],
      },
    ]);

    const result = await runResearchAgent(context({}), aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok" && !result.budgetExhausted) {
      expect(result.sources).toHaveLength(1);
      expect(result.queriesExecuted).toBe(1);
      expect(result.researchFailures).toBe(0);
    } else {
      throw new Error("expected a completed research result");
    }
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "research");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "research", 0);
  });

  it("propagates a question-generator failure without touching the research provider", async () => {
    const aiProvider = fakeAiProvider({ status: "unavailable", reason: "model retired" });
    const researchProvider = fakeResearchProvider([]);

    const result = await runResearchAgent(context({}), aiProvider, researchProvider);

    expect(result.status).toBe("unavailable");
    expect(researchProvider.search).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });
});
