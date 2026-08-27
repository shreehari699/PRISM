import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runFeasibilityAgent } from "./index";
import { feasibilityAgentOutputSchema } from "./schema";

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
  sources: [],
  solutions: [],
  researchCoverage: {
    commercial: "INSUFFICIENT",
    government: "INSUFFICIENT",
    academic: "INSUFFICIENT",
    startup: "INSUFFICIENT",
    openSource: "INSUFFICIENT",
    international: "INSUFFICIENT",
    technology: "INSUFFICIENT",
  },
  stats: {
    sourcesFound: 0,
    sourcesUsed: 0,
    solutionsIdentified: 0,
    queriesExecuted: 0,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

const validGapIntelligence: GapIntelligenceAnalysis = {
  problemSummary: "s",
  stakeholderSummary: "s",
  solutionLandscapeSummary: "s",
  gapCandidates: [],
  confirmedGaps: [],
  candidateGaps: [],
  unverifiedGaps: [],
  noGapFindings: [],
  coverageMatrix: [],
  gapPriority: [],
  gapRealityCheck: { signal: "NO_CLEAR_GAP", explanation: "e" },
  validationQuestions: [],
  evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n" },
  confidenceSummary: { overallConfidence: "LOW", narrative: "n" },
  consultantMessage: "m",
};

const validOpportunityInnovation: OpportunityInnovationAnalysis = {
  opportunities: [],
  opportunityLandscape: [],
  opportunityRealityCheck: { signal: "NO_CLEAR_OPPORTUNITY", explanation: "e" },
  overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
  consultantMessage: "m",
};

const validMarketInvestment: MarketInvestmentAnalysis = {
  marketSummary: "s",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "n/a" },
  marketEvidence: { sources: [], status: "COMPLETE", narrative: "n/a" },
  tamAnalysis: { definition: "n/a", value: unknownNumber() },
  samAnalysis: { definition: "n/a", value: unknownNumber() },
  somAnalysis: { definition: "n/a", value: unknownNumber() },
  businessModels: [],
  pricingHypotheses: [],
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
  marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  investmentRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  marketScores: {
    marketPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  investmentScores: {
    investmentReadiness: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  evidenceSummary: {
    totalSourcesReferenced: 0,
    verifiedNumbersCount: 0,
    modelEstimateNumbersCount: 0,
    unknownNumbersCount: 11,
    narrative: "n/a",
  },
  confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
  validationQuestions: [],
  consultantMessage: "m",
};

function context(upstream: Record<string, unknown> = {}) {
  return {
    phaseKey: "technical_feasibility" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
      gap_intelligence: validGapIntelligence,
      opportunity_innovation: validOpportunityInnovation,
      market_investment: validMarketInvestment,
      ...upstream,
    },
    userId: "user-1",
  };
}

const validOutput = {
  modeFeasibility: {
    mode: "HACKATHON",
    hackathon: {
      timeAvailable: { claim: "x", status: "INFERENCE", sourceIds: [], confidence: "low", reasoning: "y" },
      teamSize: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      teamSkills: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      hardwareAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      softwareAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      apiAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      dataAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      prototypeScope: "a",
      demoScope: "b",
      deploymentScope: "c",
      durationFeasibility: [],
    },
    pbl: null,
    startup: null,
    research: null,
    zeroDegree: null,
  },
  technicalFeasibility: {
    architecture: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    technologyMaturity: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    dependencies: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    apis: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    hardware: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    software: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    data: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    infrastructure: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    integration: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    security: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    performance: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    reliability: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
    maintenance: { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] },
  },
  dataFeasibility: { requirements: [], narrative: "n/a" },
  aiFeasibility: null,
  hardwareFeasibility: null,
  softwareFeasibility: {
    frontend: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    backend: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    database: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    api: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    authentication: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    deployment: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    mobileOrWeb: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    thirdPartyServices: { status: "REQUIRES_BUILD", reasoning: "n/a" },
    openSourceDependencies: { status: "REQUIRES_BUILD", reasoning: "n/a" },
  },
  teamFeasibility: { skills: [], narrative: "n/a" },
  timeFeasibility: {
    minimumViableBuildTime: unknownNumber(),
    prototypeTime: unknownNumber(),
    productionTime: unknownNumber(),
    hackathonDurationFeasibility: [],
  },
  costFeasibility: {
    developmentCost: unknownNumber(),
    hardwareCost: unknownNumber(),
    softwareCost: unknownNumber(),
    apiCost: unknownNumber(),
    infrastructureCost: unknownNumber(),
    deploymentCost: unknownNumber(),
    maintenanceCost: unknownNumber(),
  },
  regulatorySafety: { items: [], narrative: "n/a" },
  securityPrivacy: { considerations: [], securityRisk: "UNKNOWN", reasoning: "n/a" },
  scalability: {
    technical: { level: "UNKNOWN", reasoning: "n/a" },
    data: { level: "UNKNOWN", reasoning: "n/a" },
    infrastructure: { level: "UNKNOWN", reasoning: "n/a" },
    operational: { level: "UNKNOWN", reasoning: "n/a" },
    support: { level: "UNKNOWN", reasoning: "n/a" },
    geographic: { level: "UNKNOWN", reasoning: "n/a" },
    regulatory: { level: "UNKNOWN", reasoning: "n/a" },
  },
  riskRegister: [],
  buildScope: { mustBuild: [], shouldBuild: [], couldBuild: [], doNotBuild: [] },
  feasibilityScores: {
    technical: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    data: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    time: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    cost: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    team: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    deployment: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  overallFeasibility: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  criticalBlockers: [],
  feasibilityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  implementationRoadmap: [{ phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] }],
  validationQuestions: [],
  evidenceSummary: { narrative: "n/a" },
  confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
  consultantMessage: "m",
};

describe("runFeasibilityAgent", () => {
  it("returns an error without calling the provider when Phase 02 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runFeasibilityAgent(
      context({ stakeholder_pain: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 06 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runFeasibilityAgent(
      context({ market_investment: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with the feasibility agent schema when all upstream phases are valid", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runFeasibilityAgent(context(), provider);

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: feasibilityAgentOutputSchema }),
    );
  });

  it("runs cleanly when Phase 05 found no meaningful opportunity", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runFeasibilityAgent(context(), provider);

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toMatch(/did not identify a meaningful opportunity/i);
  });
});
