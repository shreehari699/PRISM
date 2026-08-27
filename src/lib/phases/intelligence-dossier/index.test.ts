import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";

import { runIntelligenceDossierPhase } from "./index";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

function richClaim(status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE") {
  return { claim: "x", status, sourceIds: [], confidence: "medium" as const, reasoning: "y" };
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

function validProblemAnatomy(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function validStakeholderPain(overrides: Record<string, unknown> = {}) {
  return {
    stakeholders: [
      {
        localId: "farmer",
        name: "Smallholder farmer",
        category: "PRIMARY",
        roles: ["USER", "BENEFICIARY"],
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
      {
        localId: "cooperative",
        name: "Farming cooperative",
        category: "SECONDARY",
        roles: ["BUYER", "DECISION_MAKER"],
        relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
        context: "ctx",
        needs: [],
        decisionPower: "medium",
        influence: "medium",
        urgency: "medium",
        impact: "medium",
        evidenceClaims: [],
        confidence: "medium",
        painPointIds: [],
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
    ...overrides,
  };
}

function validExistingSolutions(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function validGapIntelligence(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function validOpportunityInnovation(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function validMarketInvestment(overrides: Record<string, unknown> = {}) {
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
  };
}

function validTechnicalFeasibility(overrides: Record<string, unknown> = {}) {
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
  };
}

function validSolutionConsultant(overrides: Record<string, unknown> = {}) {
  return {
    solution: {
      solutionId: "sol-rec-1",
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
    successMetrics: [],
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

function validPocValidation(overrides: Record<string, unknown> = {}) {
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
      recommended: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
      simpler: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
      existing: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
      manualWorkaround: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
      conclusion: "RECOMMENDED_SOLUTION_JUSTIFIED",
      reasoning: "r",
    },
    buildRecommendation: "BUILD_WITH_CHANGES",
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
        priority: "high",
      },
      {
        validationId: "exp-2",
        hypothesis: "h2",
        method: "m",
        participantsOrData: "p",
        measurement: "m",
        successCriteria: ["works"],
        failureCriteria: ["doesn't"],
        estimatedEffort: unknownNumber(),
        priority: "low",
      },
    ],
    pocValidation: { status: "POC_VALID", explanation: "e" },
    successMetricsReview: {
      wellDefined: false,
      measurable: false,
      relevant: false,
      realistic: false,
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
    evidenceSummary: {
      totalSourcesReferenced: 0,
      verifiedClaimsCount: 0,
      contradictedClaimsCount: 0,
      narrative: "n/a",
    },
    finalValidationDecision: "PROCEED_WITH_CHANGES",
    finalValidationDecisionReasoning: ["r"],
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

function sectionSummary(importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM") {
  return { summary: "s", importance };
}

function validAgentOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: {
      whatIsTheProblem: "p",
      whoHasTheProblem: "w",
      whyDoesItMatter: "m",
      whatAlreadyExists: "e",
      whatIsMissing: "i",
      whatOpportunityExists: "o",
      canItBeBuilt: "c",
      whatShouldBeBuilt: "b",
      whatIsTheBiggestRisk: "r",
      whatShouldTheTeamDoNext: "n",
    },
    problemContext: "c",
    problemImportantUnknowns: [],
    stakeholderNarrative: "s",
    importantPainLocalIds: ["pain-1"],
    painNarrative: "p",
    importantSolutionLocalIds: ["sol-1"],
    solutionLandscapeNarrative: "s",
    mostImportantGapId: "gap-1",
    gapNarrative: "g",
    opportunityNarrative: "o",
    innovationDirectionSummary: "i",
    aiJustificationSummary: "a",
    marketNarrative: "m",
    feasibilityNarrative: "f",
    solutionArchitectureSummary: "a",
    solutionDataFlowSummary: "d",
    pocNarrative: "p",
    implementationNarrative: "i",
    redTeamSelection: {
      strongestAttackPointId: "rt-1",
      weakestAssumptionId: "assume-1",
      biggestTechnicalRiskValidationId: "val-1",
      biggestMarketRiskValidationId: null,
      biggestAdoptionRiskValidationId: null,
      mostLikelyFailureId: "fm-1",
      mitigation: "m",
    },
    topJuryQuestionIds: ["jq-1"],
    jurySummaryNarrative: "j",
    validationPlanNarrative: "v",
    nextActionPlan: [
      { step: 1, action: "Interview 5 farmers", reason: "r", expectedOutput: "e", priority: "high" },
    ],
    decisionTrace: {
      problem: { finding: "f", criticalEvidence: [] },
      pain: { finding: "f", criticalEvidence: ["pain-1"] },
      gap: { finding: "f", criticalEvidence: ["gap-1"] },
      opportunity: { finding: "f", criticalEvidence: ["opp-1"] },
      market: { finding: "f", criticalEvidence: ["source-1"] },
      feasibility: { finding: "f", criticalEvidence: [] },
      solution: { finding: "f", criticalEvidence: [] },
      validation: { finding: "f", criticalEvidence: ["assume-1"] },
    },
    majorReasons: ["The gap is real but validation is incomplete."],
    buildRecommendation: "BUILD_WITH_CHANGES",
    buildRecommendationReasoning: "r",
    sectionSummaries: {
      executiveSummary: sectionSummary(),
      problem: sectionSummary(),
      stakeholders: sectionSummary(),
      pain: sectionSummary(),
      existingSolutions: sectionSummary(),
      gaps: sectionSummary(),
      opportunity: sectionSummary(),
      market: sectionSummary(),
      feasibility: sectionSummary("HIGH"),
      solution: sectionSummary(),
      architecture: sectionSummary(),
      poc: sectionSummary(),
      implementation: sectionSummary(),
      redTeam: sectionSummary(),
      jury: sectionSummary(),
      assumptions: sectionSummary(),
      validation: sectionSummary(),
      finalVerdict: sectionSummary("CRITICAL"),
      nextActions: sectionSummary(),
      evidence: sectionSummary(),
    },
    finalConsultantMessage: "m",
    ...overrides,
  };
}

function context(upstream: Record<string, unknown> = {}, mode: string = "HACKATHON") {
  return {
    phaseKey: "intelligence_dossier" as const,
    mode: mode as "HACKATHON",
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy(),
      stakeholder_pain: validStakeholderPain(),
      existing_solutions: validExistingSolutions(),
      gap_intelligence: validGapIntelligence(),
      opportunity_innovation: validOpportunityInnovation(),
      market_investment: validMarketInvestment(),
      technical_feasibility: validTechnicalFeasibility(),
      solution_consultant: validSolutionConsultant(),
      poc_validation: validPocValidation(),
      ...upstream,
    },
    userId: "user-1",
  };
}

describe("runIntelligenceDossierPhase", () => {
  it("merges the agent output into a full dossier (happy path)", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.sectionManifest).toHaveLength(20);
      expect(result.data.recommendedSolution?.solutionName).toBe("PriceLens");
      expect(result.data.gapBrief.mostImportantGap?.gapId).toBe("gap-1");
      expect(result.data.finalVerdict.decision).toBe("BUILD_WITH_CHANGES");
    }
  });

  it("returns an error when Phase 09 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(
      context({ poc_validation: undefined }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("propagates a Report Generator failure", async () => {
    const provider = fakeProvider({ status: "unavailable", reason: "model retired" });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("unavailable");
  });

  it("rejects an unknown mostImportantGapId", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ mostImportantGapId: "ghost" }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown gap "ghost"/);
    }
  });

  it("rejects a null mostImportantGapId when real gaps exist", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ mostImportantGapId: null }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/mostImportantGapId was null/);
    }
  });

  it("rejects an unknown importantPainLocalIds entry", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ importantPainLocalIds: ["ghost-pain"] }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown pain "ghost-pain"/);
    }
  });

  it("rejects an unknown redTeamSelection.strongestAttackPointId", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        redTeamSelection: {
          strongestAttackPointId: "ghost-rt",
          weakestAssumptionId: "assume-1",
          biggestTechnicalRiskValidationId: null,
          biggestMarketRiskValidationId: null,
          biggestAdoptionRiskValidationId: null,
          mostLikelyFailureId: "fm-1",
          mitigation: "m",
        },
      }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown point "ghost-rt"/);
    }
  });

  it("rejects an unknown topJuryQuestionIds entry", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ topJuryQuestionIds: ["ghost-jq"] }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown jury question "ghost-jq"/);
    }
  });

  it("rejects an unknown decisionTrace criticalEvidence id", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        decisionTrace: {
          problem: { finding: "f", criticalEvidence: ["ghost-source"] },
          pain: { finding: "f", criticalEvidence: [] },
          gap: { finding: "f", criticalEvidence: [] },
          opportunity: { finding: "f", criticalEvidence: [] },
          market: { finding: "f", criticalEvidence: [] },
          feasibility: { finding: "f", criticalEvidence: [] },
          solution: { finding: "f", criticalEvidence: [] },
          validation: { finding: "f", criticalEvidence: [] },
        },
      }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/decisionTrace.problem cites unknown evidence "ghost-source"/);
    }
  });

  it("rejects more than five CRITICAL sections", async () => {
    const allCritical = validAgentOutput();
    for (const key of Object.keys(allCritical.sectionSummaries)) {
      (allCritical.sectionSummaries as Record<string, { importance: string }>)[key].importance = "CRITICAL";
    }
    const provider = fakeProvider({ status: "ok", model: "x", data: allCritical });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/marked CRITICAL/);
    }
  });

  it("rejects a solution grounded in a NO_GAP_ESTABLISHED gap", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ mostImportantGapId: null }),
    });

    const result = await runIntelligenceDossierPhase(
      context({
        gap_intelligence: validGapIntelligence({
          gapCandidates: [
            {
              gapId: "gap-1",
              title: "t",
              description: "d",
              affectedStakeholders: [],
              relatedPains: [],
              relatedExistingSolutions: ["sol-1"],
              missingCapability: richClaim(),
              whyItMatters: richClaim("ASSUMPTION"),
              evidenceClaims: [],
              sourceIds: [],
              gapType: "FUNCTIONAL",
              confidence: "MEDIUM",
              gapState: "NO_GAP_ESTABLISHED",
              validationStatus: "NEEDS_VALIDATION",
            },
          ],
          confirmedGaps: [],
          candidateGaps: [],
          noGapFindings: ["gap-1"],
        }),
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/NO_GAP_ESTABLISHED/);
    }
  });

  it("rejects AI_NOT_REQUIRED alongside a present aiArchitecture", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(
      context({
        solution_consultant: validSolutionConsultant({
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
      }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/AI_NOT_REQUIRED/);
    }
  });

  it("derives DO_NOT_BUILD when Phase 08 found no solution and its reality check is NOT_RECOMMENDED", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({
        buildRecommendation: "DO_NOT_BUILD",
        mostImportantGapId: null,
        importantSolutionLocalIds: [],
        solutionArchitectureSummary: null,
        solutionDataFlowSummary: null,
        pocNarrative: null,
        implementationNarrative: null,
      }),
    });

    const result = await runIntelligenceDossierPhase(
      context({
        gap_intelligence: validGapIntelligence({ candidateGaps: [], confirmedGaps: [], noGapFindings: ["gap-1"] }),
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
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("DO_NOT_BUILD");
      expect(result.data.recommendedSolution).toBeNull();
      expect(result.data.pocPlan).toBeNull();
      expect(result.data.implementationPlan).toBeNull();
    }
  });

  it("derives DO_NOT_BUILD when Phase 07 is INFEASIBLE, even if the agent proposed BUILD", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runIntelligenceDossierPhase(
      context({
        technical_feasibility: validTechnicalFeasibility({
          overallFeasibility: { status: "INFEASIBLE", explanation: "e" },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.finalVerdict.decision).toBe("DO_NOT_BUILD");
  });

  it("derives INSUFFICIENT_EVIDENCE when Phase 09's own decision is INSUFFICIENT_EVIDENCE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runIntelligenceDossierPhase(
      context({
        poc_validation: validPocValidation({ finalValidationDecision: "INSUFFICIENT_EVIDENCE" }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("INSUFFICIENT_EVIDENCE");
    }
  });

  it("derives INSUFFICIENT_EVIDENCE when the agent's own buildRecommendation is INSUFFICIENT_EVIDENCE", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "INSUFFICIENT_EVIDENCE" }),
    });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("INSUFFICIENT_EVIDENCE");
    }
  });

  it("floors the decision to the worse of Phase 09's decision and the agent's own recommendation", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "BUILD" }),
    });

    const result = await runIntelligenceDossierPhase(
      context({ poc_validation: validPocValidation({ finalValidationDecision: "PROCEED_WITH_CHANGES" }) }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("BUILD_WITH_CHANGES");
    }
  });

  it("labels a VALIDATE_BEFORE_BUILD-equivalent decision as RESEARCH_BEFORE_BUILD in RESEARCH mode", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "VALIDATE_BEFORE_BUILD" }),
    });

    const result = await runIntelligenceDossierPhase(
      context({ poc_validation: validPocValidation({ finalValidationDecision: "VALIDATE_BEFORE_BUILD" }) }, "RESEARCH"),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("RESEARCH_BEFORE_BUILD");
    }
  });

  it("keeps VALIDATE_BEFORE_BUILD in non-RESEARCH modes", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validAgentOutput({ buildRecommendation: "VALIDATE_BEFORE_BUILD" }),
    });

    const result = await runIntelligenceDossierPhase(
      context({ poc_validation: validPocValidation({ finalValidationDecision: "VALIDATE_BEFORE_BUILD" }) }, "STARTUP"),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.finalVerdict.decision).toBe("VALIDATE_BEFORE_BUILD");
    }
  });

  it("downgrades overallConfidence from HIGH when a validation claim is CONTRADICTED", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(
      context({
        poc_validation: validPocValidation({
          confidenceSummary: { overallConfidence: "HIGH", narrative: "n/a" },
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
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.overallConfidence).toBe("MEDIUM");
      expect(result.data.evidenceSummary.contradictions).toBe(1);
    }
  });

  it("computes evidenceSummary from structured upstream data", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(
      context({
        market_investment: validMarketInvestment({
          competitiveLandscape: {
            competitors: [],
            summary: {
              claim: "x",
              status: "VERIFIED",
              sourceIds: ["source-1"],
              confidence: "medium",
              reasoning: "y",
            },
          },
        }),
      }),
      provider,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.evidenceSummary.assumptions).toBeGreaterThanOrEqual(1);
      expect(result.data.evidenceSummary.sourcesUsed).toBeGreaterThanOrEqual(1);
    }
  });

  it("sorts the validation plan by priority, highest first", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validAgentOutput() });

    const result = await runIntelligenceDossierPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.validationPlan.experiments[0]?.validationId).toBe("exp-1");
    }
  });
});
