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

const { runExistingSolutionsPhase } = await import("./index");

function fakeAiProviderSequence(
  results: Awaited<ReturnType<AiProvider["generateStructured"]>>[],
): AiProvider {
  const generateStructured = vi.fn();
  for (const result of results) generateStructured.mockResolvedValueOnce(result);
  return { name: "fake", model: "fake-model", generateStructured };
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

function context() {
  return {
    phaseKey: "existing_solutions" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy,
      stakeholder_pain: validStakeholderPain,
    },
    userId: "user-1",
  };
}

const questionOutput = {
  queries: [
    {
      query: "government crop pricing platform India",
      category: "GOVERNMENT",
      reason: "r",
      targetInformation: "t",
    },
  ],
};

const rawSource = {
  title: "eNAM",
  url: "https://enam.gov.in",
  sourceType: "government" as const,
  retrievedAt: new Date().toISOString(),
  snippet: "A national electronic trading platform.",
  relevance: 0.9,
};

function validSolution(overrides: Record<string, unknown> = {}) {
  return {
    localId: "sol-1",
    name: "eNAM",
    organization: "Government of India",
    country: "India",
    yearIfVerified: "2016",
    solutionType: "GOVERNMENT_PROGRAM",
    problemAddressed: { claim: "x", status: "VERIFIED", reasoning: "y" },
    howItWorks: { claim: "x", status: "INFERENCE", reasoning: "y" },
    deploymentStatus: "ACTIVE",
    businessModelIfKnown: "UNKNOWN",
    sourceIds: ["source-1"],
    confidence: "medium",
    costInformation: "UNKNOWN",
    geographicCoverage: "India",
    evidenceConfidence: "medium",
    ...overrides,
  };
}

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

describe("runExistingSolutionsPhase", () => {
  it("runs the full pipeline: research -> extraction -> merge with computed stats and coverage", async () => {
    const aiProvider = fakeAiProviderSequence([
      { status: "ok", model: "x", data: questionOutput, usage: { totalTokens: 100 } },
      {
        status: "ok",
        model: "x",
        data: {
          solutions: [validSolution()],
          consultantMessage: "We're not the first to attack this — a government platform already exists.",
        },
        usage: { totalTokens: 200 },
      },
    ]);
    const researchProvider = fakeResearchProvider([
      { status: "ok", provider: "tavily", sources: [rawSource] },
    ]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.stats).toEqual({
        sourcesFound: 1,
        sourcesUsed: 1,
        solutionsIdentified: 1,
        queriesExecuted: 1,
        researchFailures: 0,
        budgetExhausted: false,
      });
      expect(result.data.researchCoverage.government).toBe("LOW");
      expect(result.data.researchCoverage.academic).toBe("INSUFFICIENT");
      expect(result.usage?.totalTokens).toBe(300);
    }
  });

  it("propagates a Research Agent failure without calling the Existing Solution Agent", async () => {
    const aiProvider = fakeAiProviderSequence([{ status: "unavailable", reason: "model retired" }]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("unavailable");
    expect(aiProvider.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("propagates an Existing Solution Agent failure", async () => {
    const aiProvider = fakeAiProviderSequence([
      { status: "ok", model: "x", data: questionOutput },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);
    const researchProvider = fakeResearchProvider([
      { status: "ok", provider: "tavily", sources: [rawSource] },
    ]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("invalid_output");
  });

  it("rejects a solution citing a source id that was never returned by research", async () => {
    const aiProvider = fakeAiProviderSequence([
      { status: "ok", model: "x", data: questionOutput },
      {
        status: "ok",
        model: "x",
        data: {
          solutions: [validSolution({ sourceIds: ["ghost-source"] })],
          consultantMessage: "n/a",
        },
      },
    ]);
    const researchProvider = fakeResearchProvider([
      { status: "ok", provider: "tavily", sources: [rawSource] },
    ]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/source id that wasn't among/);
    }
  });

  it("produces an honest, non-fabricated result when the research budget is exhausted", async () => {
    checkUsageMock.mockResolvedValue({
      allowed: false,
      safeMode: true,
      reason: "Daily research request limit reached (30/day).",
      remaining: { daily: 0, monthly: 5 },
    });
    const aiProvider = fakeAiProviderSequence([
      {
        status: "ok",
        model: "x",
        data: { solutions: [], consultantMessage: "Research capacity reached. PRISM preserved the evidence already collected." },
      },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.stats.budgetExhausted).toBe(true);
      expect(result.data.solutions).toEqual([]);
      expect(result.data.sources).toEqual([]);
      expect(Object.values(result.data.researchCoverage)).toEqual(
        Array(7).fill("INSUFFICIENT"),
      );
    }
    // Question-generator + Tavily search were both skipped; only the
    // Existing Solution Agent's call happened, since it still writes a
    // real message explaining the exhausted budget.
    expect(researchProvider.search).not.toHaveBeenCalled();
    expect(aiProvider.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("allows a genuinely empty result — zero solutions is not a failure", async () => {
    const aiProvider = fakeAiProviderSequence([
      { status: "ok", model: "x", data: questionOutput },
      { status: "ok", model: "x", data: { solutions: [], consultantMessage: "No credible existing solutions surfaced." } },
    ]);
    const researchProvider = fakeResearchProvider([
      { status: "ok", provider: "tavily", sources: [] },
    ]);

    const result = await runExistingSolutionsPhase(context(), aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.solutions).toEqual([]);
      expect(result.data.stats.solutionsIdentified).toBe(0);
    }
  });
});
