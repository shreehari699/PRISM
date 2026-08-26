import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { ResearchProvider, ResearchResult } from "@/lib/research";

const checkUsageMock = vi.fn();
const recordUsageMock = vi.fn();

vi.mock("@/lib/usage", () => ({
  checkUsage: (...args: unknown[]) => checkUsageMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

const { runMarketInvestmentPhase } = await import("./index");

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

function providerWithSequence(results: unknown[]): AiProvider {
  const generateStructured = vi.fn();
  for (const r of results) generateStructured.mockResolvedValueOnce(r);
  return { name: "fake", model: "fake-model", generateStructured };
}

function fakeResearchProvider(responses: ResearchResult[]): ResearchProvider {
  const search = vi.fn();
  for (const response of responses) search.mockResolvedValueOnce(response);
  return { name: "fake", isConfigured: true, search };
}

function claim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function score() {
  return { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" };
}

function unknownNumber() {
  return {
    status: "UNKNOWN" as const,
    value: null,
    unit: null,
    currency: null,
    geography: null,
    period: null,
    sourceIds: [],
    calculation: null,
    confidence: "low" as const,
    reasoning: "n/a",
  };
}

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
  primaryPain: { painLocalId: "pain-1", reasoning: "r" },
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

const validExistingSolutions: ExistingSolutionsAnalysis = {
  queries: [],
  sources: [
    {
      title: "eNAM",
      url: "https://enam.gov.in",
      sourceType: "government",
      retrievedAt: new Date().toISOString(),
      snippet: "A national electronic trading platform.",
      sourceLocalId: "source-1",
      query: "government crop pricing platform",
      category: "GOVERNMENT",
    },
  ],
  solutions: [],
  researchCoverage: {
    commercial: "INSUFFICIENT",
    government: "LOW",
    academic: "INSUFFICIENT",
    startup: "INSUFFICIENT",
    openSource: "INSUFFICIENT",
    international: "INSUFFICIENT",
    technology: "INSUFFICIENT",
  },
  stats: {
    sourcesFound: 1,
    sourcesUsed: 0,
    solutionsIdentified: 0,
    queriesExecuted: 1,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    title: "District-level price transparency service",
    description: "d",
    unservedNeed: claim("INFERENCE"),
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedGaps: ["gap-1"],
    existingSolutionContext: claim("ASSUMPTION"),
    whyNow: { factors: [], summary: "s" },
    impact: [],
    valuePotential: score(),
    impactPotential: score(),
    evidenceClaims: [],
    confidence: "medium",
    opportunityState: "PROMISING_OPPORTUNITY",
    innovationDirections: [],
    differentiation: claim("ASSUMPTION"),
    innovationPotential: score(),
    feasibilityPotential: score(),
    validationQuestions: [],
    ...overrides,
  };
}

function landscapeEntry(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    stakeholderValue: "medium",
    painRelevance: "medium",
    gapStrength: "medium",
    differentiationStrength: "low",
    innovationStrength: "medium",
    feasibilityStrength: "high",
    impactStrength: "medium",
    confidence: "medium",
    reasoning: "n/a",
    rank: 1,
    ...overrides,
  };
}

function validOpportunityInnovation(
  overrides: Partial<OpportunityInnovationAnalysis> = {},
): OpportunityInnovationAnalysis {
  return {
    opportunities: [opportunity()],
    opportunityLandscape: [landscapeEntry()],
    opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
    overallFinding: "MEANINGFUL_OPPORTUNITY_FOUND",
    consultantMessage: "m",
    ...overrides,
  } as OpportunityInnovationAnalysis;
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    phaseKey: "market_investment" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
      opportunity_innovation: validOpportunityInnovation(),
      ...overrides,
    },
    userId: "user-1",
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

function validMarketOutput(overrides: Record<string, unknown> = {}) {
  return {
    marketSummary: "s",
    customerModel: null,
    marketSegments: [],
    competitiveLandscape: { competitors: [], summary: claim("ASSUMPTION") },
    marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
    adoptionAnalysis: { factors: [], adoptionRisk: "MEDIUM", reasoning: "n/a" },
    tamAnalysis: { definition: "n/a", value: unknownNumber() },
    samAnalysis: { definition: "n/a", value: unknownNumber() },
    somAnalysis: { definition: "n/a", value: unknownNumber() },
    businessModels: [],
    unitEconomics: {
      customerAcquisitionCost: unknownNumber(),
      revenuePerCustomer: unknownNumber(),
      grossMargin: unknownNumber(),
      operationalCost: unknownNumber(),
      supportCost: unknownNumber(),
      infrastructureCost: unknownNumber(),
      paybackPeriod: unknownNumber(),
      narrative: "n/a",
    },
    scalability: {
      technical: { level: "UNKNOWN", reasoning: "n/a" },
      operational: { level: "UNKNOWN", reasoning: "n/a" },
      geographic: { level: "UNKNOWN", reasoning: "n/a" },
      customer: { level: "UNKNOWN", reasoning: "n/a" },
      support: { level: "UNKNOWN", reasoning: "n/a" },
      regulatory: { level: "UNKNOWN", reasoning: "n/a" },
      data: { level: "UNKNOWN", reasoning: "n/a" },
    },
    marketRealityCheck: { signal: "EARLY_MARKET", explanation: "e" },
    marketScores: {
      marketPotential: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      commercialPotential: { value: 30, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      adoptionPotential: { value: 35, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      scalability: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    },
    validationQuestions: [],
    ...overrides,
  };
}

function validInvestmentOutput(overrides: Record<string, unknown> = {}) {
  return {
    investmentAnalysis: {
      capitalIntensity: "MODERATE",
      capitalIntensityReasoning: "r",
      initialDevelopmentRequirements: [],
      infrastructureRequirements: [],
      teamRequirements: [],
      operationalRequirements: [],
      deploymentRequirements: [],
      fundingStageRecommendation: "PRE_SEED",
      fundingStageReasoning: "r",
    },
    valuationDrivers: { drivers: [], illustrativeScenario: null },
    investmentRealityCheck: { signal: "RESEARCH_BEFORE_INVESTMENT", explanation: "e" },
    investmentScores: {
      investmentReadiness: { value: 25, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    },
    confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
    validationQuestions: [],
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runMarketInvestmentPhase", () => {
  it("merges all three calls, reuses Phase 03 sources, and computes evidence/pricing/rank-derived fields", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validQuestionOutput, usage: { totalTokens: 50 } },
      { status: "ok", model: "x", data: validMarketOutput(), usage: { totalTokens: 100 } },
      { status: "ok", model: "x", data: validInvestmentOutput(), usage: { totalTokens: 100 } },
    ]);
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
            snippet: "Market size estimate.",
          },
        ],
      },
    ]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.marketEvidence.sources).toHaveLength(2);
      expect(result.data.marketEvidence.status).toBe("COMPLETE");
      expect(result.data.pricingHypotheses).toEqual([]);
      expect(result.usage?.totalTokens).toBe(250);
    }
  });

  it("returns an error when Phase 05 output is missing", async () => {
    const provider = providerWithSequence([]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(
      context({ opportunity_innovation: undefined }),
      provider,
      researchProvider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error when Phase 03 output is missing", async () => {
    const provider = providerWithSequence([]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(
      context({ existing_solutions: undefined }),
      provider,
      researchProvider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("propagates a market research question-generator failure", async () => {
    const provider = providerWithSequence([{ status: "unavailable", reason: "model retired" }]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("unavailable");
    expect(researchProvider.search).not.toHaveBeenCalled();
  });

  it("propagates a Market Agent failure", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("invalid_output");
  });

  it("propagates an Investment Agent failure", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      { status: "ok", model: "x", data: validMarketOutput() },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("invalid_output");
  });

  it("rejects a market analysis citing an unknown source", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      {
        status: "ok",
        model: "x",
        data: validMarketOutput({
          competitiveLandscape: { competitors: [], summary: claim("VERIFIED", ["ghost-source"]) },
        }),
      },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source/);
    }
  });

  it("accepts a market analysis citing a reused Phase 03 source", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      {
        status: "ok",
        model: "x",
        data: validMarketOutput({
          competitiveLandscape: { competitors: [], summary: claim("VERIFIED", ["source-1"]) },
        }),
      },
      { status: "ok", model: "x", data: validInvestmentOutput() },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("ok");
  });

  it("rejects a competitor described with market-leadership language without VERIFIED evidence", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      {
        status: "ok",
        model: "x",
        data: validMarketOutput({
          competitiveLandscape: {
            competitors: [
              {
                name: "eNAM",
                organization: "Government of India",
                solution: "National trading platform",
                targetCustomer: "Farmers",
                classification: "DIRECT",
                strength: claim("INFERENCE"),
                limitation: claim("INFERENCE"),
                marketPositionIfVerified: {
                  ...claim("ASSUMPTION"),
                  claim: "eNAM is the market leader in this space.",
                },
                sourceIds: [],
                confidence: "medium",
              },
            ],
            summary: claim("ASSUMPTION"),
          },
        }),
      },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/market-leadership language/);
    }
  });

  it("rejects a SAM larger than TAM", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      {
        status: "ok",
        model: "x",
        data: validMarketOutput({
          tamAnalysis: {
            definition: "d",
            value: { ...unknownNumber(), status: "VERIFIED", value: 1000, unit: "amount", currency: "INR", sourceIds: ["source-1"] },
          },
          samAnalysis: {
            definition: "d",
            value: { ...unknownNumber(), status: "VERIFIED", value: 2000, unit: "amount", currency: "INR", sourceIds: ["source-1"] },
          },
        }),
      },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/SAM .* cannot exceed TAM/);
    }
  });

  it("runs the market research question generator with no leading opportunity when Phase 05 found none", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      { status: "ok", model: "x", data: validMarketOutput() },
      { status: "ok", model: "x", data: validInvestmentOutput() },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(
      context({
        opportunity_innovation: validOpportunityInnovation({
          opportunities: [],
          opportunityLandscape: [],
          overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
        }),
      }),
      provider,
      researchProvider,
    );

    expect(result.status).toBe("ok");
    expect(researchProvider.search).not.toHaveBeenCalled();
    const questionGenCall = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(questionGenCall.prompt).toMatch(/did not identify a meaningful opportunity/i);
  });

  it("marks evidence PARTIAL_MARKET_EVIDENCE when the research budget was exhausted", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validMarketOutput() },
      { status: "ok", model: "x", data: validInvestmentOutput() },
    ]);
    const researchProvider = fakeResearchProvider([]);

    checkUsageMock.mockResolvedValueOnce({
      allowed: false,
      safeMode: true,
      reason: "Daily research request limit reached (30/day).",
      remaining: { daily: 0, monthly: 5 },
    });

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.marketEvidence.status).toBe("PARTIAL_MARKET_EVIDENCE");
    }
  });

  it("merges and deduplicates validationQuestions from both agents", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: { queries: [] } },
      {
        status: "ok",
        model: "x",
        data: validMarketOutput({ validationQuestions: ["Is pricing sensitivity known?", "shared question"] }),
      },
      {
        status: "ok",
        model: "x",
        data: validInvestmentOutput({ validationQuestions: ["shared question", "Is funding appetite known?"] }),
      },
    ]);
    const researchProvider = fakeResearchProvider([]);

    const result = await runMarketInvestmentPhase(context(), provider, researchProvider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.validationQuestions).toEqual([
        "Is pricing sensitivity known?",
        "shared question",
        "Is funding appetite known?",
      ]);
    }
  });
});
