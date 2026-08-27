import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";
import type { SolutionConsultantAnalysis } from "@/lib/phases/solution-consultant/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

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

function richClaim(status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE") {
  return { claim: "x", status, sourceIds: [], confidence: "medium" as const, reasoning: "y" };
}

const problemAnatomy: ProblemAnatomy = {
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

const stakeholderPain: StakeholderPainAnalysis = {
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
  validationQuestions: [],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "n/a",
};

const existingSolutions: ExistingSolutionsAnalysis = {
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

const gapIntelligence: GapIntelligenceAnalysis = {
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

const opportunityInnovation: OpportunityInnovationAnalysis = {
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
      valuePotential: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      impactPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      evidenceClaims: [],
      confidence: "medium",
      opportunityState: "PROMISING_OPPORTUNITY",
      innovationDirections: [],
      differentiation: richClaim("ASSUMPTION"),
      innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
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

const marketInvestment: MarketInvestmentAnalysis = {
  marketSummary: "The market for district-level price transparency is early but plausible.",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: richClaim("ASSUMPTION"),
  },
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
    marketPotential: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 30, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 35, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  investmentScores: {
    investmentReadiness: { value: 25, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
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
};

const technicalFeasibility: TechnicalFeasibilityAnalysis = {
  modeFeasibility: {
    mode: "HACKATHON",
    hackathon: {
      timeAvailable: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
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
    technical: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    data: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    time: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    cost: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    team: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    deployment: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
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
};

function baseSolution() {
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
    solutionType: "SOFTWARE" as const,
    technologyApproach: "t",
    aiRole: {
      classification: "AI_NOT_REQUIRED" as const,
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
    userJourney: [{ stage: "START" as const, description: "d" }],
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
    confidence: "medium" as const,
  };
}

function baseSolutionConsultant(
  overrides: Partial<SolutionConsultantAnalysis> = {},
): SolutionConsultantAnalysis {
  return {
    solution: baseSolution(),
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
    acknowledgedCriticalBlockers: ["No required data"],
    solutionRealityCheck: { status: "RECOMMENDED_WITH_CONSTRAINTS", explanation: "e" },
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
    confidenceSummary: { overallConfidence: "MODERATE", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  } as SolutionConsultantAnalysis;
}

describe("buildSystemInstruction (Validation Agent)", () => {
  it("frames PRISM as the toughest judge in the room", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/toughest judge in the room/i);
  });

  it("forbids fabricating a citation to fake evidence-validated status", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/never fabricate a citation/i);
  });

  it("requires selecting the critical assumption from the real register", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/never create a new one just for this field/i);
  });

  it("allows concluding the simpler solution is better", () => {
    const instruction = buildSystemInstruction("ZERO_DEGREE", ["strategic_relevance"]);
    expect(instruction).toMatch(/simpler solution.*is actually better/i);
  });

  it("states PRISM must be comfortable with a negative verdict", () => {
    const instruction = buildSystemInstruction("PBL", ["objectives"]);
    expect(instruction).toMatch(/this is a bad idea/i);
  });
});

describe("buildUserPrompt (Validation Agent)", () => {
  it("embeds the recommended solution and critical blockers", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      problemAnatomy,
      stakeholderPain,
      existingSolutions,
      gapIntelligence,
      opportunityInnovation,
      marketInvestment,
      technicalFeasibility,
      baseSolutionConsultant(),
    );
    expect(prompt).toContain("[sol-1]");
    expect(prompt).toContain("No required data");
    expect(prompt).toContain("[source-1]");
  });

  it("tells the model to recommend DO_NOT_BUILD when Phase 08 found no solution", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      problemAnatomy,
      stakeholderPain,
      existingSolutions,
      gapIntelligence,
      opportunityInnovation,
      marketInvestment,
      technicalFeasibility,
      baseSolutionConsultant({
        solution: null,
        solutionRealityCheck: { status: "NOT_RECOMMENDED", explanation: "No opportunity." },
      }),
    );
    expect(prompt).toMatch(/buildRecommendation must be DO_NOT_BUILD/);
  });
});
