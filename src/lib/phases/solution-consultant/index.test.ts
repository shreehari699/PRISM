import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";

import { runSolutionConsultantPhase } from "./index";

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
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function score() {
  return { value: 40, basis: "ai_estimate" as const, reasoning: "n/a", confidence: "low" as const };
}

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    title: "District-level price transparency service",
    description: "d",
    unservedNeed: richClaim(),
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedGaps: ["gap-1"],
    existingSolutionContext: richClaim("ASSUMPTION"),
    whyNow: { factors: [], summary: "s" },
    impact: [],
    valuePotential: score(),
    impactPotential: score(),
    evidenceClaims: [],
    confidence: "medium",
    opportunityState: "PROMISING_OPPORTUNITY",
    innovationDirections: [],
    differentiation: richClaim("ASSUMPTION"),
    innovationPotential: score(),
    feasibilityPotential: score(),
    validationQuestions: [],
    ...overrides,
  };
}

function validOpportunityInnovation(
  overrides: Partial<OpportunityInnovationAnalysis> = {},
): OpportunityInnovationAnalysis {
  return {
    opportunities: [opportunity()],
    opportunityLandscape: [
      {
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
      },
    ],
    opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
    overallFinding: "MEANINGFUL_OPPORTUNITY_FOUND",
    consultantMessage: "m",
    ...overrides,
  } as OpportunityInnovationAnalysis;
}

function gapCandidate(overrides: Record<string, unknown> = {}) {
  return {
    gapId: "gap-1",
    title: "No automated prioritization",
    description: "d",
    affectedStakeholders: ["farmer"],
    relatedPains: [],
    relatedExistingSolutions: [],
    missingCapability: richClaim(),
    whyItMatters: richClaim("ASSUMPTION"),
    evidenceClaims: [],
    sourceIds: [],
    gapType: "FUNCTIONAL",
    confidence: "MEDIUM",
    gapState: "CANDIDATE_GAP",
    validationStatus: "NEEDS_VALIDATION",
    ...overrides,
  };
}

function validGapIntelligence(
  overrides: Record<string, unknown> = {},
): GapIntelligenceAnalysis {
  return {
    problemSummary: "s",
    stakeholderSummary: "s",
    solutionLandscapeSummary: "s",
    gapCandidates: [gapCandidate()],
    confirmedGaps: [],
    candidateGaps: ["gap-1"],
    unverifiedGaps: [],
    noGapFindings: [],
    coverageMatrix: [],
    gapPriority: [],
    gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
    validationQuestions: [],
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
    consultantMessage: "n/a",
    ...overrides,
  } as GapIntelligenceAnalysis;
}

function validMarketInvestment(
  overrides: Record<string, unknown> = {},
): MarketInvestmentAnalysis {
  return {
    marketSummary: "s",
    customerModel: null,
    marketSegments: [],
    competitiveLandscape: { competitors: [], summary: richClaim("ASSUMPTION") },
    marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
    adoptionAnalysis: { factors: [], adoptionRisk: "MEDIUM", reasoning: "n/a" },
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
    marketRealityCheck: { signal: "EARLY_MARKET", explanation: "e" },
    investmentRealityCheck: { signal: "RESEARCH_BEFORE_INVESTMENT", explanation: "e" },
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
    confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
    validationQuestions: [],
    consultantMessage: "m",
    ...overrides,
  } as MarketInvestmentAnalysis;
}

function validTechnicalFeasibility(
  overrides: Record<string, unknown> = {},
): TechnicalFeasibilityAnalysis {
  return {
    modeFeasibility: {
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
    riskRegister: [
      {
        riskId: "risk-1",
        title: "Dataset may not be obtainable",
        category: "DATA",
        description: "d",
        likelihood: "medium",
        impact: "high",
        severity: "high",
        mitigation: "m",
        residualRisk: "medium",
        basis: "ai_estimate",
        confidence: "low",
      },
    ],
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
    overallFeasibility: { status: "CONDITIONALLY_FEASIBLE", explanation: "e" },
    criticalBlockers: [{ title: "No required data", description: "d", category: "DATA" }],
    feasibilityRealityCheck: { signal: "BUILDABLE_WITH_CONSTRAINTS", explanation: "e" },
    implementationRoadmap: [
      { phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] },
    ],
    validationQuestions: [],
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
    confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
    criticalBlockersSummary: "BLOCKERS_IDENTIFIED",
    consultantMessage: "m",
    ...overrides,
  } as TechnicalFeasibilityAnalysis;
}

const validStakeholderPain: StakeholderPainAnalysis = {
  stakeholders: [
    {
      localId: "farmer",
      name: "Smallholder farmer",
      category: "PRIMARY",
      roles: ["USER"],
      relationshipToProblem: richClaim(),
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
      cause: richClaim(),
      frequency: richClaim(),
      riskIfUnsolved: richClaim("ASSUMPTION"),
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
  solutions: [
    {
      localId: "sol-1",
      name: "eNAM",
      organization: "Government of India",
      country: "India",
      yearIfVerified: "2016",
      solutionType: "GOVERNMENT_PROGRAM",
      targetUsers: [],
      targetStakeholders: [],
      problemAddressed: richClaim("VERIFIED"),
      painAddressed: [],
      howItWorks: richClaim(),
      technology: [],
      deploymentStatus: "ACTIVE",
      businessModelIfKnown: "UNKNOWN",
      strengths: [],
      limitations: [],
      evidenceClaims: [],
      sourceIds: ["source-1"],
      confidence: "medium",
      stakeholderCoverage: ["farmer"],
      painCoverage: ["pain-1"],
      costInformation: "UNKNOWN",
      geographicCoverage: "India",
      evidenceConfidence: "medium",
    },
  ],
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
    sourcesUsed: 1,
    solutionsIdentified: 1,
    queriesExecuted: 1,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

function context(upstream: Record<string, unknown> = {}) {
  return {
    phaseKey: "solution_consultant" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
      gap_intelligence: validGapIntelligence(),
      opportunity_innovation: validOpportunityInnovation(),
      market_investment: validMarketInvestment(),
      technical_feasibility: validTechnicalFeasibility(),
      ...upstream,
    },
    userId: "user-1",
  };
}

function validSolution(overrides: Record<string, unknown> = {}) {
  return {
    solutionId: "sol-1",
    name: "PriceLens",
    tagline: "t",
    executiveSummary: "s",
    problemAddressed: richClaim(),
    primaryUsers: ["farmer"],
    customers: [],
    beneficiaries: ["farmer"],
    coreValueProposition: "v",
    validatedGapId: "gap-1",
    opportunityId: "opp-1",
    differentiation: {
      genuinelyDifferent: "a",
      incremental: "b",
      defensible: "c",
      merelyAFeature: "d",
      overallClaim: richClaim("ASSUMPTION"),
    },
    solutionType: "SOFTWARE",
    technologyApproach: "t",
    aiRole: {
      classification: "AI_NOT_REQUIRED",
      whyAiIsNeeded: "n/a",
      whatAiDoes: "n/a",
      whatAiDoesNot: "n/a",
      reasoning: "y",
    },
    hardwareRole: null,
    softwareRole: "s",
    dataRole: "d",
    workflow: ["step 1"],
    architecture: {
      inputs: [],
      processing: [],
      aiComponents: [],
      deterministicComponents: [],
      database: [],
      externalApis: [],
      hardware: [],
      outputs: [],
    },
    userJourney: [{ stage: "START", description: "d" }],
    coreFeatures: [],
    mustHaveFeatures: [],
    futureFeatures: [],
    implementationPlan: [
      {
        stepNumber: 0,
        objective: "o",
        deliverable: "d",
        dependency: "n/a",
        estimatedEffort: unknownNumber(),
        risk: "n/a",
        completionCondition: "c",
      },
    ],
    risks: [],
    limitations: [],
    evidenceClaims: [],
    confidence: "medium",
    ...overrides,
  };
}

const validModeSolutionPlan = {
  mode: "HACKATHON",
  hackathon: {
    buildPlan24Hour: ["step 1"],
    demoFlow: ["show the app"],
    mustBuild: [],
    shouldBuild: [],
    doNotBuild: [],
    demoNarrative: "n",
    judgeFacingValueProposition: "v",
  },
  pbl: null,
  startup: null,
  research: null,
  zeroDegree: null,
};

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    solution: validSolution(),
    whyThisSolution: {
      painAddressed: "p",
      gapAddressed: "g",
      opportunityAddressed: "o",
      existingSolutionLimitations: "l",
      feasibilityRationale: "f",
      marketRationale: "m",
      summary: "s",
    },
    alternativesConsidered: [],
    featureScope: { mustHave: [{ title: "core feature", reasoning: "r" }], shouldHave: [], future: [{ title: "future feature", reasoning: "r" }], doNotBuild: [] },
    dataFlow: {
      input: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      ingestion: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      validation: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      processing: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      intelligence: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      decision: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
      output: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    },
    engineeringSafety: null,
    aiArchitecture: null,
    humanInTheLoop: [],
    technologyStack: [],
    pocDefinition: {
      objective: "o",
      scope: "s",
      input: "i",
      process: "p",
      output: "out",
      successCriteria: ["works"],
      failureCriteria: ["doesn't work"],
    },
    successMetrics: [],
    modeSolutionPlan: validModeSolutionPlan,
    acknowledgedCriticalBlockers: ["No required data"],
    solutionRealityCheck: { status: "RECOMMENDED_WITH_CONSTRAINTS", explanation: "e" },
    evidenceSummary: { narrative: "n/a" },
    confidenceSummary: { overallConfidence: "MODERATE", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runSolutionConsultantPhase", () => {
  it("merges the agent output, computing evidenceSummary and feature-scope projections", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.solution?.coreFeatures).toEqual([{ title: "core feature", reasoning: "r" }]);
      expect(result.data.solution?.mustHaveFeatures).toEqual([{ title: "core feature", reasoning: "r" }]);
      expect(result.data.solution?.futureFeatures).toEqual([{ title: "future feature", reasoning: "r" }]);
      expect(result.data.evidenceSummary.totalSourcesReferenced).toBe(0);
    }
  });

  it("returns an error when Phase 07 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runSolutionConsultantPhase(
      context({ technical_feasibility: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("propagates a Solution Consultant failure", async () => {
    const provider = fakeProvider({ status: "unavailable", reason: "model retired" });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("unavailable");
  });

  it("rejects a mode solution plan evaluated for the wrong mode", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        modeSolutionPlan: { ...validModeSolutionPlan, mode: "STARTUP" },
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

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
        modeSolutionPlan: {
          ...validModeSolutionPlan,
          startup: {
            productScope: "s",
            customerValue: "c",
            businessModel: "b",
            deployment: "d",
            scaling: "s",
            security: "s",
            operations: "o",
            roadmapSummary: "r",
          },
        },
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

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
        modeSolutionPlan: {
          mode: "HACKATHON",
          hackathon: null,
          pbl: null,
          startup: null,
          research: null,
          zeroDegree: null,
        },
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/missing the "hackathon" mode block/);
    }
  });

  it("rejects a solution produced when Phase 05 found no meaningful opportunity", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runSolutionConsultantPhase(
      context({
        opportunity_innovation: validOpportunityInnovation({
          opportunities: [],
          opportunityLandscape: [],
          overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/must not be manufactured/);
    }
  });

  it("rejects a null solution when Phase 05 has a leading opportunity", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ solution: null }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/returned no solution/);
    }
  });

  it("rejects a solution addressing the wrong opportunity", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ solution: validSolution({ opportunityId: "opp-2" }) }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/selected leading opportunity/);
    }
  });

  it("rejects a solution referencing an unknown gap", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ solution: validSolution({ validatedGapId: "ghost-gap" }) }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown gap/);
    }
  });

  it("rejects a solution grounded in a NO_GAP_ESTABLISHED gap", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput() });

    const result = await runSolutionConsultantPhase(
      context({
        gap_intelligence: validGapIntelligence({
          gapCandidates: [gapCandidate({ gapState: "NO_GAP_ESTABLISHED" })],
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/NO_GAP_ESTABLISHED/);
    }
  });

  it("rejects a superlative differentiation claim without VERIFIED evidence", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        solution: validSolution({
          differentiation: {
            genuinelyDifferent: "a",
            incremental: "b",
            defensible: "c",
            merelyAFeature: "d",
            overallClaim: { ...richClaim("ASSUMPTION"), claim: "The only platform doing this." },
          },
        }),
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/superlative differentiation/);
    }
  });

  it("accepts a superlative differentiation claim when VERIFIED with a real source", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        solution: validSolution({
          differentiation: {
            genuinelyDifferent: "a",
            incremental: "b",
            defensible: "c",
            merelyAFeature: "d",
            overallClaim: { ...richClaim("VERIFIED", ["source-1"]), claim: "The only platform doing this." },
          },
        }),
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);
    expect(result.status).toBe("ok");
  });

  it("rejects AI_REQUIRED with no aiArchitecture provided", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        solution: validSolution({
          aiRole: {
            classification: "AI_REQUIRED",
            whyAiIsNeeded: "n",
            whatAiDoes: "n",
            whatAiDoesNot: "n",
            reasoning: "y",
          },
        }),
        aiArchitecture: null,
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/no aiArchitecture was provided/);
    }
  });

  it("rejects AI_NOT_REQUIRED with an aiArchitecture provided anyway", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        aiArchitecture: {
          modelRole: "r",
          input: "i",
          promptOrTask: "p",
          output: "o",
          validation: "v",
          fallback: "f",
          humanReview: "h",
        },
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/aiArchitecture was provided anyway/);
    }
  });

  it("rejects a solution risk citing an unknown Phase 07 risk id", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        solution: validSolution({
          risks: [
            {
              riskId: "solution-risk-1",
              sourceRiskId: "ghost-risk",
              title: "t",
              category: "TECHNICAL",
              impact: "medium",
              mitigation: "m",
              fallback: "f",
              residualRisk: "low",
              basis: "ai_estimate",
              confidence: "low",
            },
          ],
        }),
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown Phase 07 risk/);
    }
  });

  it("rejects RECOMMENDED_TO_BUILD when Phase 07's overall feasibility is INFEASIBLE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ solutionRealityCheck: { status: "RECOMMENDED_TO_BUILD", explanation: "e" } }),
    });

    const result = await runSolutionConsultantPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          overallFeasibility: { status: "INFEASIBLE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cannot be RECOMMENDED_TO_BUILD/);
    }
  });

  it("rejects output that fails to acknowledge a Phase 07 critical blocker", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ acknowledgedCriticalBlockers: [] }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/never acknowledged/);
    }
  });

  it("rejects STRONG confidence when Phase 07's confidence is INSUFFICIENT_EVIDENCE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({ confidenceSummary: { overallConfidence: "STRONG", narrative: "n/a" } }),
    });

    const result = await runSolutionConsultantPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cannot claim STRONG confidence/);
    }
  });

  it("rejects a citation to an unknown source", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        whyThisSolution: {
          painAddressed: "p",
          gapAddressed: "g",
          opportunityAddressed: "o",
          existingSolutionLimitations: "l",
          feasibilityRationale: "f",
          marketRationale: "m",
          summary: "s",
        },
        solution: validSolution({ problemAddressed: richClaim("VERIFIED", ["ghost-source"]) }),
      }),
    });

    const result = await runSolutionConsultantPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source/);
    }
  });

  it("allows a null solution and NOT_RECOMMENDED reality check when there is no meaningful opportunity", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validOutput({
        solution: null,
        whyThisSolution: null,
        featureScope: null,
        dataFlow: null,
        pocDefinition: null,
        acknowledgedCriticalBlockers: [],
        solutionRealityCheck: { status: "NOT_RECOMMENDED", explanation: "e" },
      }),
    });

    const result = await runSolutionConsultantPhase(
      context({
        opportunity_innovation: validOpportunityInnovation({
          opportunities: [],
          opportunityLandscape: [],
          overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
        }),
        technical_feasibility: validTechnicalFeasibility({ criticalBlockers: [] }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.solution).toBeNull();
    }
  });
});
