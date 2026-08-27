import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";

import { runTechnicalFeasibilityPhase } from "./index";

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

function richClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "low", reasoning: "y" };
}

function technicalDimension(status = "UNKNOWN") {
  return { status, reasoning: "n/a", confidence: "low", evidenceClaims: [] };
}

function softwareComponent() {
  return { status: "REQUIRES_BUILD", reasoning: "n/a" };
}

function scalabilityAssessment() {
  return { level: "UNKNOWN", reasoning: "n/a" };
}

function score() {
  return { value: 20, basis: "ai_estimate" as const, reasoning: "n/a", confidence: "low" as const };
}

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
  marketEvidence: {
    sources: [
      {
        sourceLocalId: "source-1",
        title: "eNAM",
        url: "https://enam.gov.in",
        sourceType: "government",
        retrievedAt: new Date().toISOString(),
        snippet: "A national electronic trading platform.",
        origin: "existing_solutions_reused",
      },
    ],
    status: "COMPLETE",
    narrative: "n/a",
  },
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
    marketPotential: score(),
    commercialPotential: score(),
    adoptionPotential: score(),
    scalability: score(),
  },
  investmentScores: { investmentReadiness: score() },
  evidenceSummary: {
    totalSourcesReferenced: 1,
    verifiedNumbersCount: 0,
    modelEstimateNumbersCount: 0,
    unknownNumbersCount: 11,
    narrative: "n/a",
  },
  confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
  validationQuestions: [],
  consultantMessage: "m",
};

const validStakeholderPain = {
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

const validExistingSolutions = {
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

const validGapIntelligence = {
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

const validOpportunityInnovation = {
  opportunities: [],
  opportunityLandscape: [],
  opportunityRealityCheck: { signal: "NO_CLEAR_OPPORTUNITY", explanation: "e" },
  overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
  consultantMessage: "m",
};

function context(mode: "HACKATHON" | "STARTUP" = "HACKATHON", upstream: Record<string, unknown> = {}) {
  return {
    phaseKey: "technical_feasibility" as const,
    mode,
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

function validHackathonModeFeasibility(overrides: Record<string, unknown> = {}) {
  return {
    mode: "HACKATHON",
    hackathon: {
      timeAvailable: richClaim(),
      teamSize: richClaim(),
      teamSkills: richClaim(),
      hardwareAccess: richClaim(),
      softwareAccess: richClaim(),
      apiAccess: richClaim(),
      dataAccess: richClaim(),
      prototypeScope: "a",
      demoScope: "b",
      deploymentScope: "c",
      durationFeasibility: [],
    },
    pbl: null,
    startup: null,
    research: null,
    zeroDegree: null,
    ...overrides,
  };
}

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    modeFeasibility: validHackathonModeFeasibility(),
    technicalFeasibility: {
      architecture: technicalDimension(),
      technologyMaturity: technicalDimension(),
      dependencies: technicalDimension(),
      apis: technicalDimension(),
      hardware: technicalDimension(),
      software: technicalDimension(),
      data: technicalDimension(),
      infrastructure: technicalDimension(),
      integration: technicalDimension(),
      security: technicalDimension(),
      performance: technicalDimension(),
      reliability: technicalDimension(),
      maintenance: technicalDimension(),
    },
    dataFeasibility: { requirements: [], narrative: "n/a" },
    aiFeasibility: null,
    hardwareFeasibility: null,
    softwareFeasibility: {
      frontend: softwareComponent(),
      backend: softwareComponent(),
      database: softwareComponent(),
      api: softwareComponent(),
      authentication: softwareComponent(),
      deployment: softwareComponent(),
      mobileOrWeb: softwareComponent(),
      thirdPartyServices: softwareComponent(),
      openSourceDependencies: softwareComponent(),
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
      technical: scalabilityAssessment(),
      data: scalabilityAssessment(),
      infrastructure: scalabilityAssessment(),
      operational: scalabilityAssessment(),
      support: scalabilityAssessment(),
      geographic: scalabilityAssessment(),
      regulatory: scalabilityAssessment(),
    },
    riskRegister: [],
    buildScope: { mustBuild: [], shouldBuild: [], couldBuild: [], doNotBuild: [] },
    feasibilityScores: {
      technical: score(),
      data: score(),
      time: score(),
      cost: score(),
      team: score(),
      deployment: score(),
      scalability: score(),
    },
    overallFeasibility: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
    criticalBlockers: [],
    feasibilityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
    implementationRoadmap: [
      { phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] },
    ],
    validationQuestions: [],
    evidenceSummary: { narrative: "n/a" },
    confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runTechnicalFeasibilityPhase", () => {
  it("merges the agent's output and computes evidenceSummary/criticalBlockersSummary", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.criticalBlockersSummary).toBe("NONE_IDENTIFIED");
      expect(result.data.evidenceSummary.totalSourcesReferenced).toBe(0);
      expect(result.data.evidenceSummary.verifiedClaimsCount).toBe(0);
    }
  });

  it("returns an error when Phase 06 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runTechnicalFeasibilityPhase(
      context("HACKATHON", { market_investment: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("propagates a Feasibility Agent failure", async () => {
    const provider = fakeProvider({ status: "unavailable", reason: "model retired" });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("unavailable");
  });

  it("rejects a mode mismatch between modeFeasibility.mode and context.mode", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ modeFeasibility: { ...validHackathonModeFeasibility(), mode: "STARTUP" } }),
    });

    const result = await runTechnicalFeasibilityPhase(context("HACKATHON"), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/but this project is "HACKATHON"/);
    }
  });

  it("rejects a populated mode block that doesn't match context.mode", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        modeFeasibility: {
          ...validHackathonModeFeasibility(),
          startup: {
            customerDeployment: richClaim(),
            complianceRequirements: richClaim(),
            operationalReadiness: richClaim(),
            notes: "n",
          },
        },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context("HACKATHON"), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/populated the "startup" mode block/);
    }
  });

  it("rejects a missing mode block for the active mode", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        modeFeasibility: { mode: "HACKATHON", hackathon: null, pbl: null, startup: null, research: null, zeroDegree: null },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context("HACKATHON"), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/missing the "hackathon" mode block/);
    }
  });

  it("rejects a citation to an unknown source", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        dataFeasibility: {
          requirements: [
            {
              requiredData: "d",
              dataSource: "s",
              availability: "AVAILABLE",
              quality: richClaim("VERIFIED", ["ghost-source"]),
              accessibility: richClaim(),
              privacy: richClaim(),
              licensing: richClaim(),
              updateFrequency: "daily",
            },
          ],
          narrative: "n/a",
        },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source/);
    }
  });

  it("accepts a citation to a known (Phase 06) source and counts it as verified", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        dataFeasibility: {
          requirements: [
            {
              requiredData: "d",
              dataSource: "s",
              availability: "AVAILABLE",
              quality: richClaim("VERIFIED", ["source-1"]),
              accessibility: richClaim(),
              privacy: richClaim(),
              licensing: richClaim(),
              updateFrequency: "daily",
            },
          ],
          narrative: "n/a",
        },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.evidenceSummary.totalSourcesReferenced).toBe(1);
      expect(result.data.evidenceSummary.verifiedClaimsCount).toBe(1);
    }
  });

  it("rejects FEASIBLE overall status when a critical blocker exists", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        overallFeasibility: { status: "FEASIBLE", explanation: "e" },
        criticalBlockers: [
          { title: "No required data", description: "d", category: "DATA" },
        ],
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cannot be "FEASIBLE"/);
    }
  });

  it("rejects HIGHLY_FEASIBLE overall status when a technical dimension is INFEASIBLE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        overallFeasibility: { status: "HIGHLY_FEASIBLE", explanation: "e" },
        technicalFeasibility: {
          architecture: technicalDimension("INFEASIBLE"),
          technologyMaturity: technicalDimension(),
          dependencies: technicalDimension(),
          apis: technicalDimension(),
          hardware: technicalDimension(),
          software: technicalDimension(),
          data: technicalDimension(),
          infrastructure: technicalDimension(),
          integration: technicalDimension(),
          security: technicalDimension(),
          performance: technicalDimension(),
          reliability: technicalDimension(),
          maintenance: technicalDimension(),
        },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
  });

  it("rejects FEASIBLE overall status when required data is UNAVAILABLE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        overallFeasibility: { status: "FEASIBLE", explanation: "e" },
        dataFeasibility: {
          requirements: [
            {
              requiredData: "d",
              dataSource: "s",
              availability: "UNAVAILABLE",
              quality: richClaim(),
              accessibility: richClaim(),
              privacy: richClaim(),
              licensing: richClaim(),
              updateFrequency: "n/a",
            },
          ],
          narrative: "n/a",
        },
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
  });

  it("allows a critical blocker alongside an honestly non-positive overall status", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        overallFeasibility: { status: "CONDITIONALLY_FEASIBLE", explanation: "e" },
        criticalBlockers: [
          { title: "No required data", description: "d", category: "DATA" },
        ],
      }),
    });

    const result = await runTechnicalFeasibilityPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.criticalBlockersSummary).toBe("BLOCKERS_IDENTIFIED");
    }
  });
});
