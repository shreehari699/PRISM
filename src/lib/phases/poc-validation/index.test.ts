import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { SolutionConsultantAnalysis } from "@/lib/phases/solution-consultant/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";

import { runPocValidationPhase } from "./index";

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

function score() {
  return { value: 40, basis: "ai_estimate" as const, reasoning: "n/a", confidence: "low" as const };
}

function richClaim(status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE") {
  return { claim: "x", status, sourceIds: [], confidence: "medium" as const, reasoning: "y" };
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
    overallFeasibility: { status: "CONDITIONALLY_FEASIBLE", explanation: "e" },
    criticalBlockers: [],
    feasibilityRealityCheck: { signal: "BUILDABLE_WITH_CONSTRAINTS", explanation: "e" },
    implementationRoadmap: [
      { phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] },
    ],
    validationQuestions: [],
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
    confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
    criticalBlockersSummary: "NONE_IDENTIFIED",
    consultantMessage: "m",
    ...overrides,
  } as TechnicalFeasibilityAnalysis;
}

function validSolutionConsultant(
  overrides: Record<string, unknown> = {},
): SolutionConsultantAnalysis {
  return {
    solution: {
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
    },
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
    featureScope: { mustHave: [], shouldHave: [], future: [], doNotBuild: [] },
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
      output: "o",
      successCriteria: ["works"],
      failureCriteria: ["doesn't work"],
    },
    successMetrics: [{ metric: "signups", targetValue: 100, unit: "users", status: "TARGET", reasoning: "r" }],
    modeSolutionPlan: {
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
    },
    acknowledgedCriticalBlockers: [],
    solutionRealityCheck: { status: "RECOMMENDED_WITH_CONSTRAINTS", explanation: "e" },
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
    confidenceSummary: { overallConfidence: "MODERATE", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  } as SolutionConsultantAnalysis;
}

const validProblemAnatomy = {
  restatement: "Farmers lack real-time crop pricing.",
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

const validGapIntelligence = {
  problemSummary: "s",
  stakeholderSummary: "s",
  solutionLandscapeSummary: "s",
  gapCandidates: [
    {
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
    },
  ],
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
};

const validOpportunityInnovation = {
  opportunities: [
    {
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
    },
  ],
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
};

function context(upstream: Record<string, unknown> = {}) {
  return {
    phaseKey: "poc_validation" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy,
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
      gap_intelligence: validGapIntelligence,
      opportunity_innovation: validOpportunityInnovation,
      market_investment: validMarketInvestment(),
      technical_feasibility: validTechnicalFeasibility(),
      solution_consultant: validSolutionConsultant(),
      ...upstream,
    },
    userId: "user-1",
  };
}

function juryReview() {
  return {
    strengths: ["s"],
    questions: ["q"],
    concerns: ["c"],
    criticalQuestion: "cq",
    scoreOrAssessment: score(),
    reasoning: "r",
    confidence: "medium" as const,
  };
}

function counterSolutionOption() {
  return { description: "d", addressesCoreProblem: "a", tradeoffs: "t" };
}

function validAgentOutput(overrides: Record<string, unknown> = {}) {
  return {
    validationClaims: [
      {
        validationId: "val-1",
        domain: "MARKET_VALIDATION",
        claim: "c",
        question: "q",
        evidence: "e",
        evidenceStatus: "ASSUMPTION",
        sourceIds: [],
        finding: "f",
        confidence: "medium",
        severity: "medium",
        recommendedAction: "a",
      },
    ],
    assumptionRegister: [
      {
        assumptionId: "assume-1",
        assumption: "Farmers will pay for pricing data.",
        category: "MARKET",
        whyItMatters: "w",
        dependency: "d",
        confidence: "medium",
        validationMethod: "m",
        failureImpact: "f",
        status: "SUPPORTED",
      },
    ],
    redTeamReview: {
      points: [
        {
          pointId: "rt-1",
          argument: "a",
          category: "HYPOTHETICAL",
          targetArea: "t",
          severity: "medium",
          sourceIds: [],
        },
      ],
      mostFragileAssumptionId: "assume-1",
      hiddenDependencies: [],
      keyTechnologyFailureImpact: null,
      summary: "s",
    },
    jury: {
      technicalJudge: juryReview(),
      domainExpert: juryReview(),
      businessJudge: juryReview(),
      impactJudge: juryReview(),
      productJudge: juryReview(),
    },
    juryQuestions: [
      {
        questionId: "jq-1",
        question: "q",
        bestAnswer: "a",
        evidence: "e",
        sourceIds: [],
        confidence: "medium",
        answerStatus: "DEFENSIBLE",
      },
    ],
    failureModes: [
      {
        failureId: "fm-1",
        failure: "f",
        cause: "c",
        impact: "i",
        likelihood: "medium",
        severity: "medium",
        detection: "d",
        mitigation: "m",
        fallback: "fb",
        basis: "ai_estimate",
        confidence: "low",
      },
    ],
    preMortem: {
      scenario: "s",
      entries: [
        { failureReason: "r", earlyWarningSignal: "w", preventiveAction: "p", fallback: "f" },
      ],
    },
    counterSolutionAnalysis: {
      simplestAlternative: "s",
      recommended: counterSolutionOption(),
      simpler: counterSolutionOption(),
      existing: counterSolutionOption(),
      manualWorkaround: counterSolutionOption(),
      conclusion: "RECOMMENDED_SOLUTION_JUSTIFIED",
      reasoning: "r",
    },
    buildRecommendation: "BUILD",
    buildRecommendationReasoning: "r",
    validationPlan: [
      {
        validationId: "exp-1",
        hypothesis: "h",
        method: "m",
        participantsOrData: "p",
        measurement: "m",
        successCriteria: ["works"],
        failureCriteria: ["doesn't"],
        estimatedEffort: unknownNumber(),
        priority: "medium",
      },
    ],
    pocValidation: { status: "POC_VALID", explanation: "e" },
    successMetricsReview: {
      wellDefined: true,
      measurable: true,
      relevant: true,
      realistic: true,
      explanation: "e",
    },
    criticalAssumption: { assumptionId: "assume-1", reasoning: "r" },
    validationScores: {
      problemConfidence: score(),
      solutionConfidence: score(),
      marketConfidence: score(),
      technicalConfidence: score(),
      adoptionConfidence: score(),
      evidenceConfidence: score(),
    },
    evidenceSummary: { narrative: "n/a" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runPocValidationPhase", () => {
  it("merges the agent output and computes evidenceSummary + finalValidationDecision (happy path)", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.evidenceSummary.totalSourcesReferenced).toBe(0);
      expect(result.data.evidenceSummary.verifiedClaimsCount).toBe(0);
      expect(result.data.evidenceSummary.contradictedClaimsCount).toBe(0);
      expect(result.data.finalValidationDecision).toBe("VALIDATED_TO_PROCEED");
    }
  });

  it("returns an error when Phase 08 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runPocValidationPhase(
      context({ solution_consultant: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("propagates a Validation Agent failure", async () => {
    const provider = fakeProvider({ status: "unavailable", reason: "model retired" });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("unavailable");
  });

  it("rejects a criticalAssumption referencing an unknown assumptionId", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ criticalAssumption: { assumptionId: "ghost", reasoning: "r" } }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown assumption "ghost"/);
    }
  });

  it("rejects a red team mostFragileAssumptionId referencing an unknown assumption", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        redTeamReview: {
          points: [
            {
              pointId: "rt-1",
              argument: "a",
              category: "HYPOTHETICAL",
              targetArea: "t",
              severity: "medium",
              sourceIds: [],
            },
          ],
          mostFragileAssumptionId: "ghost",
          hiddenDependencies: [],
          keyTechnologyFailureImpact: null,
          summary: "s",
        },
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/most fragile/);
    }
  });

  it("rejects a buildRecommendation other than DO_NOT_BUILD when Phase 08 found no solution", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runPocValidationPhase(
      context({
        solution_consultant: validSolutionConsultant({
          solution: null,
          pocDefinition: null,
          successMetrics: [],
          solutionRealityCheck: { status: "NOT_RECOMMENDED", explanation: "No opportunity." },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/instead of DO_NOT_BUILD/);
    }
  });

  it("rejects pocValidation NO_POC_DEFINED when Phase 08 actually defined a POC", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ pocValidation: { status: "NO_POC_DEFINED", explanation: "e" } }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/claimed NO_POC_DEFINED/);
    }
  });

  it("rejects a pocValidation status other than NO_POC_DEFINED when Phase 08 defined no POC", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "DO_NOT_BUILD",
        pocValidation: { status: "POC_VALID", explanation: "e" },
      }),
    });

    const result = await runPocValidationPhase(
      context({
        solution_consultant: validSolutionConsultant({
          solution: null,
          pocDefinition: null,
          successMetrics: [],
          solutionRealityCheck: { status: "NOT_RECOMMENDED", explanation: "No opportunity." },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/was not NO_POC_DEFINED/);
    }
  });

  it("rejects a successMetricsReview claiming quality when Phase 08 proposed no metrics", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runPocValidationPhase(
      context({ solution_consultant: validSolutionConsultant({ successMetrics: [] }) }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/proposed no success metrics/);
    }
  });

  it("rejects HIGH overallConfidence when a validation claim is CONTRADICTED", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        validationClaims: [
          {
            validationId: "val-1",
            domain: "MARKET_VALIDATION",
            claim: "c",
            question: "q",
            evidence: "e",
            evidenceStatus: "CONTRADICTED",
            sourceIds: [],
            finding: "f",
            confidence: "medium",
            severity: "high",
            recommendedAction: "a",
          },
        ],
        confidenceSummary: { overallConfidence: "HIGH", narrative: "n/a" },
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cannot be HIGH/);
    }
  });

  it("rejects HIGH overallConfidence when the critical assumption is UNSUPPORTED", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        assumptionRegister: [
          {
            assumptionId: "assume-1",
            assumption: "Farmers will pay for pricing data.",
            category: "MARKET",
            whyItMatters: "w",
            dependency: "d",
            confidence: "medium",
            validationMethod: "m",
            failureImpact: "f",
            status: "UNSUPPORTED",
          },
        ],
        confidenceSummary: { overallConfidence: "HIGH", narrative: "n/a" },
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cannot be HIGH/);
    }
  });

  it("rejects a citation to an unknown source", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        validationClaims: [
          {
            validationId: "val-1",
            domain: "MARKET_VALIDATION",
            claim: "c",
            question: "q",
            evidence: "e",
            evidenceStatus: "VERIFIED",
            sourceIds: ["source-ghost"],
            finding: "f",
            confidence: "medium",
            severity: "medium",
            recommendedAction: "a",
          },
        ],
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source/);
    }
  });

  it("derives DO_NOT_BUILD when Phase 08 found no solution and its reality check is NOT_RECOMMENDED", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "DO_NOT_BUILD",
        pocValidation: { status: "NO_POC_DEFINED", explanation: "No POC was defined." },
        successMetricsReview: {
          wellDefined: false,
          measurable: false,
          relevant: false,
          realistic: false,
          explanation: "No metrics were proposed.",
        },
      }),
    });

    const result = await runPocValidationPhase(
      context({
        solution_consultant: validSolutionConsultant({
          solution: null,
          pocDefinition: null,
          successMetrics: [],
          solutionRealityCheck: { status: "NOT_RECOMMENDED", explanation: "No opportunity." },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.finalValidationDecision).toBe("DO_NOT_BUILD");
  });

  it("derives INSUFFICIENT_EVIDENCE when Phase 08 found no solution for a reason other than NOT_RECOMMENDED", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "DO_NOT_BUILD",
        pocValidation: { status: "NO_POC_DEFINED", explanation: "No POC was defined." },
        successMetricsReview: {
          wellDefined: false,
          measurable: false,
          relevant: false,
          realistic: false,
          explanation: "No metrics were proposed.",
        },
      }),
    });

    const result = await runPocValidationPhase(
      context({
        solution_consultant: validSolutionConsultant({
          solution: null,
          pocDefinition: null,
          successMetrics: [],
          solutionRealityCheck: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalValidationDecision).toBe("INSUFFICIENT_EVIDENCE");
    }
  });

  it("derives DO_NOT_BUILD when Phase 07's overall feasibility is INFEASIBLE, even if the agent proposed BUILD", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runPocValidationPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          overallFeasibility: { status: "INFEASIBLE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.finalValidationDecision).toBe("DO_NOT_BUILD");
  });

  it("derives DO_NOT_BUILD when evidence contradicts the core problem, even if the agent proposed BUILD", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "BUILD",
        validationClaims: [
          {
            validationId: "val-1",
            domain: "PROBLEM_VALIDATION",
            claim: "c",
            question: "q",
            evidence: "e",
            evidenceStatus: "CONTRADICTED",
            sourceIds: [],
            finding: "f",
            confidence: "medium",
            severity: "high",
            recommendedAction: "a",
          },
        ],
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.finalValidationDecision).toBe("DO_NOT_BUILD");
  });

  it("floors the decision at VALIDATE_BEFORE_BUILD when the critical assumption is UNSUPPORTED, even if the agent proposed BUILD", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "BUILD",
        assumptionRegister: [
          {
            assumptionId: "assume-1",
            assumption: "Farmers will pay for pricing data.",
            category: "MARKET",
            whyItMatters: "w",
            dependency: "d",
            confidence: "medium",
            validationMethod: "m",
            failureImpact: "f",
            status: "UNSUPPORTED",
          },
        ],
      }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalValidationDecision).toBe("VALIDATE_BEFORE_BUILD");
    }
  });

  it("floors the decision at PROCEED_WITH_CHANGES when Phase 07 has unresolved critical blockers, even if the agent proposed BUILD", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runPocValidationPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          criticalBlockers: [{ title: "No required data", description: "d", category: "DATA" }],
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalValidationDecision).toBe("PROCEED_WITH_CHANGES");
    }
  });

  it("floors the decision when technically feasible but validation confidence is only MEDIUM", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "BUILD",
        confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n/a" },
      }),
    });

    const result = await runPocValidationPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          overallFeasibility: { status: "FEASIBLE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalValidationDecision).toBe("PROCEED_WITH_CHANGES");
    }
  });

  it("floors the decision further when technically feasible but validation confidence is LOW", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "BUILD",
        confidenceSummary: { overallConfidence: "LOW", narrative: "n/a" },
      }),
    });

    const result = await runPocValidationPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          overallFeasibility: { status: "HIGHLY_FEASIBLE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalValidationDecision).toBe("VALIDATE_BEFORE_BUILD");
    }
  });

  it("respects the agent's own worse recommendation even when no deterministic floor applies", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "DO_NOT_BUILD" }),
    });

    const result = await runPocValidationPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.finalValidationDecision).toBe("DO_NOT_BUILD");
  });
});
