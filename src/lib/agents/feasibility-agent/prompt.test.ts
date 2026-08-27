import { describe, expect, it } from "vitest";

import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

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
  innovationDirections: [
    {
      directionType: "SOFTWARE",
      whyItCouldAddressTheGap: "a",
      whatItWouldChange: "b",
      stakeholderBenefit: "c",
      newCapability: "d",
      assumptionsRequired: [],
      aiJustification: { classification: "AI_OPTIONAL", reasoning: "e" },
    },
  ],
  differentiation: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
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

const existingSolutions: ExistingSolutionsAnalysis = {
  queries: [],
  sources: [],
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
      problemAddressed: { claim: "x", status: "VERIFIED", reasoning: "y" },
      painAddressed: [],
      howItWorks: { claim: "x", status: "INFERENCE", reasoning: "y" },
      technology: ["Java", "PostgreSQL"],
      deploymentStatus: "ACTIVE",
      businessModelIfKnown: "UNKNOWN",
      strengths: [],
      limitations: [],
      evidenceClaims: [],
      sourceIds: [],
      confidence: "medium",
      stakeholderCoverage: ["farmer"],
      painCoverage: [],
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
    sourcesFound: 0,
    sourcesUsed: 0,
    solutionsIdentified: 1,
    queriesExecuted: 0,
    researchFailures: 0,
    budgetExhausted: false,
  },
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

describe("buildSystemInstruction (Feasibility Agent)", () => {
  it("distinguishes good idea from buildable idea", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/not 'is this a good idea'/i);
  });

  it("gives hackathon-specific instructions and no other mode's", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/modeFeasibility\.hackathon/);
    expect(instruction).toMatch(/NOT to build/i);
  });

  it("gives PBL-specific instructions", () => {
    const instruction = buildSystemInstruction("PBL", ["methodology"]);
    expect(instruction).toMatch(/modeFeasibility\.pbl/);
  });

  it("forbids letting an average score hide a critical blocker", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/do not let an average score hide a critical blocker/i);
  });

  it("allows NOT_FEASIBLE_NOW as a legitimate outcome", () => {
    const instruction = buildSystemInstruction("ZERO_DEGREE", ["strategic_relevance"]);
    expect(instruction).toMatch(/NOT_FEASIBLE_NOW/);
  });
});

describe("buildUserPrompt (Feasibility Agent)", () => {
  it("embeds the leading opportunity, gaps, and market summary", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      leadingOpportunity,
      stakeholderPain,
      gapIntelligence,
      existingSolutions,
      marketInvestment,
    );
    expect(prompt).toContain("District-level price transparency service");
    expect(prompt).toContain("[gap-1]");
    expect(prompt).toContain("[source-1]");
  });

  it("notes when there is no leading opportunity", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      null,
      stakeholderPain,
      gapIntelligence,
      existingSolutions,
      marketInvestment,
    );
    expect(prompt).toMatch(/did not identify a meaningful opportunity/i);
  });
});
