import { describe, expect, it } from "vitest";

import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
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
  differentiation: { claim: "A potential differentiation.", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
  innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  validationQuestions: [],
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
      painPointIds: [],
    },
  ],
  painPoints: [],
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
      missingCapability: { claim: "x", status: "INFERENCE", sourceIds: [], confidence: "medium", reasoning: "y" },
      whyItMatters: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
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

const marketInvestment: MarketInvestmentAnalysis = {
  marketSummary: "The market for district-level price transparency is early but plausible.",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
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
  criticalBlockers: [
    { title: "No required data", description: "d", category: "DATA" },
  ],
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

describe("buildSystemInstruction (Solution Consultant)", () => {
  it("frames the phase as moving from analysis to recommendation", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/PRISM stops analyzing and starts recommending/i);
  });

  it("forbids manufacturing a solution when there is no opportunity", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/do not manufacture a solution/i);
  });

  it("states the mandatory decision logic tying reality check to Phase 07 feasibility", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/cannot be RECOMMENDED_TO_BUILD/);
  });

  it("forbids replacing deterministic engineering calculations with an LLM", () => {
    const instruction = buildSystemInstruction("ZERO_DEGREE", ["strategic_relevance"]);
    expect(instruction).toMatch(/never be treated as the authority/i);
  });

  it("gives hackathon-specific instructions", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/modeSolutionPlan\.hackathon/);
  });
});

describe("buildUserPrompt (Solution Consultant)", () => {
  it("embeds the leading opportunity, gaps, and critical blockers", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      leadingOpportunity,
      stakeholderPain,
      gapIntelligence,
      marketInvestment,
      technicalFeasibility,
    );
    expect(prompt).toContain("[opp-1]");
    expect(prompt).toContain("[gap-1]");
    expect(prompt).toContain("No required data");
  });

  it("notes when there is no leading opportunity", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      null,
      stakeholderPain,
      gapIntelligence,
      marketInvestment,
      technicalFeasibility,
    );
    expect(prompt).toMatch(/did not identify a meaningful opportunity/i);
  });
});
