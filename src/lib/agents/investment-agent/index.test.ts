import { describe, expect, it, vi } from "vitest";

import type { MarketEvidenceSourceInput } from "@/lib/agents/market-agent/prompt";
import type { MarketAgentOutput } from "@/lib/agents/market-agent/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";

import { runInvestmentAgent } from "./index";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
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

const marketAnalysis: MarketAgentOutput = {
  marketSummary: "s",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "n/a" },
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
  marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  marketScores: {
    marketPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  validationQuestions: [],
};

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

const sources: MarketEvidenceSourceInput[] = [
  {
    sourceLocalId: "source-1",
    title: "eNAM",
    url: "https://enam.gov.in",
    snippet: "A national e-market platform for agricultural commodities.",
    origin: "existing_solutions_reused",
  },
];

function context() {
  return {
    phaseKey: "market_investment" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {},
    userId: "user-1",
  };
}

const validOutput = {
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
};

describe("runInvestmentAgent", () => {
  it("calls the provider with a schema that accepts a valid output", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInvestmentAgent(
      context(),
      leadingOpportunity,
      marketAnalysis,
      sources,
      provider,
    );

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toContain("District-level price transparency service");
    expect(call.schema.safeParse(validOutput).success).toBe(true);
  });

  // The latent instance of the Phase 05 GAP-001 bug class this agent
  // carried: illustrativeScenario.calculation.inputs[].sourceIds is
  // reachable and validated by the composer against real evidence source
  // ids, but was never constrained at the schema level either.
  it("builds a schema that rejects a gap id used as an illustrativeScenario calculation input's sourceIds", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runInvestmentAgent(context(), leadingOpportunity, marketAnalysis, sources, provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    const withGapAsSource = {
      ...validOutput,
      valuationDrivers: {
        drivers: [],
        illustrativeScenario: {
          status: "ILLUSTRATIVE_MODEL_ESTIMATE",
          value: 500_000,
          currency: "INR",
          calculation: {
            inputs: [{ label: "x", value: 1, unit: "count", sourceIds: ["gap-1"] }],
            formula: "x",
            assumptions: [],
          },
          reasoning: "y",
        },
      },
    };
    const withRealSource = {
      ...withGapAsSource,
      valuationDrivers: {
        ...withGapAsSource.valuationDrivers,
        illustrativeScenario: {
          ...withGapAsSource.valuationDrivers.illustrativeScenario,
          calculation: {
            ...withGapAsSource.valuationDrivers.illustrativeScenario.calculation,
            inputs: [{ label: "x", value: 1, unit: "count", sourceIds: ["source-1"] }],
          },
        },
      },
    };

    expect(call.schema.safeParse(withGapAsSource).success).toBe(false);
    expect(call.schema.safeParse(withRealSource).success).toBe(true);
  });

  it("runs cleanly when there is no leading opportunity", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInvestmentAgent(context(), null, marketAnalysis, sources, provider);

    expect(result.status).toBe("ok");
  });

  // Latent instance of the Phase 05 GAP-001 bug class: illustrativeScenario
  // calculation inputs can carry a sourceIds field validated against the
  // real evidence source list, but this agent previously was never shown
  // that list at all.
  it("shows the model the real evidence source ids, so it has something valid to cite", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runInvestmentAgent(context(), leadingOpportunity, marketAnalysis, sources, provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toContain("source-1");
    expect(call.prompt).toMatch(/evidence sources/i);
  });
});
