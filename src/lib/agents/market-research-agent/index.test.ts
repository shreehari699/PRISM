import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { ResearchProvider, ResearchResult } from "@/lib/research";

const checkUsageMock = vi.fn();
const recordUsageMock = vi.fn();

vi.mock("@/lib/usage", () => ({
  checkUsage: (...args: unknown[]) => checkUsageMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

const { runMarketResearchAgent } = await import("./index");

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

const leadingOpportunity: Opportunity = {
  opportunityId: "opp-1",
  title: "District-level price transparency service",
  description: "d",
  unservedNeed: { claim: "x", status: "INFERENCE", sourceIds: [], confidence: "medium", reasoning: "y" },
  affectedStakeholders: ["farmer"],
  relatedPains: ["pain-1"],
  relatedGaps: ["gap-1"],
  existingSolutionContext: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
  whyNow: { factors: [], summary: "s" },
  impact: [],
  valuePotential: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  impactPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  evidenceClaims: [],
  confidence: "medium",
  opportunityState: "PROMISING_OPPORTUNITY",
  innovationDirections: [],
  differentiation: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
  innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  validationQuestions: [],
};

function context(options: { userId?: string } = {}) {
  return {
    phaseKey: "market_investment" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {},
    userId: "userId" in options ? options.userId : "user-1",
  };
}

const validQuestionOutput = {
  queries: [
    {
      query: "market size for crop price transparency platforms in India",
      category: "MARKET_SIZE",
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

describe("runMarketResearchAgent", () => {
  it("returns an error when context has no userId", async () => {
    const aiProvider = fakeAiProvider({ status: "ok", model: "x", data: validQuestionOutput });
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketResearchAgent(
      context({ userId: undefined }),
      leadingOpportunity,
      aiProvider,
      researchProvider,
    );

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

    const result = await runMarketResearchAgent(
      context({}),
      leadingOpportunity,
      aiProvider,
      researchProvider,
    );

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
            title: "Crop pricing market report",
            url: "https://example.com/report",
            sourceType: "market",
            retrievedAt: new Date().toISOString(),
            snippet: "Market size estimate for crop pricing platforms.",
          },
        ],
      },
    ]);

    const result = await runMarketResearchAgent(
      context({}),
      leadingOpportunity,
      aiProvider,
      researchProvider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok" && !result.budgetExhausted) {
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]!.sourceLocalId).toBe("market-source-1");
      expect(result.queriesExecuted).toBe(1);
      expect(result.researchFailures).toBe(0);
    } else {
      throw new Error("expected a completed research result");
    }
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "research");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "research", 0);
  });

  it("tallies a research provider failure without aborting the batch", async () => {
    const aiProvider = fakeAiProvider({
      status: "ok",
      model: "x",
      data: {
        queries: [
          { query: "q1", category: "MARKET_SIZE", reason: "r", targetInformation: "t" },
          { query: "q2", category: "ADOPTION", reason: "r", targetInformation: "t" },
        ],
      },
    });
    const researchProvider = fakeResearchProvider([
      { status: "unavailable", reason: "timeout", provider: "tavily" },
      {
        status: "ok",
        provider: "tavily",
        sources: [
          {
            title: "Adoption survey",
            url: "https://example.com/adoption",
            sourceType: "market",
            retrievedAt: new Date().toISOString(),
            snippet: "Adoption rate data.",
          },
        ],
      },
    ]);

    const result = await runMarketResearchAgent(
      context({}),
      leadingOpportunity,
      aiProvider,
      researchProvider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok" && !result.budgetExhausted) {
      expect(result.sources).toHaveLength(1);
      expect(result.researchFailures).toBe(1);
      expect(result.queriesExecuted).toBe(2);
    } else {
      throw new Error("expected a completed research result");
    }
  });

  it("propagates a question-generator failure without touching the research provider", async () => {
    const aiProvider = fakeAiProvider({ status: "unavailable", reason: "model retired" });
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketResearchAgent(
      context({}),
      leadingOpportunity,
      aiProvider,
      researchProvider,
    );

    expect(result.status).toBe("unavailable");
    expect(researchProvider.search).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it("passes an empty query list through cleanly when there is no leading opportunity", async () => {
    const aiProvider = fakeAiProvider({ status: "ok", model: "x", data: { queries: [] } });
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketResearchAgent(context({}), null, aiProvider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok" && !result.budgetExhausted) {
      expect(result.sources).toEqual([]);
      expect(result.queriesExecuted).toBe(0);
    } else {
      throw new Error("expected a completed research result");
    }
    expect(researchProvider.search).not.toHaveBeenCalled();
  });
});
