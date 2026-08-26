import { describe, expect, it } from "vitest";

import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt, type MarketEvidenceSourceInput } from "./prompt";

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

const sources: MarketEvidenceSourceInput[] = [
  {
    sourceLocalId: "market-source-1",
    title: "Indian agtech market report",
    url: "https://example.com/report",
    snippet: "Market size estimate.",
    origin: "market_research",
  },
];

describe("buildSystemInstruction (Market Agent)", () => {
  it("forbids fabricated market numbers", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/NO FABRICATED MARKET NUMBERS/);
    expect(instruction).toMatch(/Never invent a TAM/);
  });

  it("forbids claiming market leadership without evidence", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/Never claim market leadership or dominance/);
  });

  it("allows a weak-market conclusion as a legitimate outcome", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/large problem, weak market/i);
  });
});

describe("buildUserPrompt (Market Agent)", () => {
  it("embeds the leading opportunity and evidence sources", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      leadingOpportunity,
      stakeholderPain,
      existingSolutions,
      sources,
      { queriesExecuted: 2, researchFailures: 0, budgetExhausted: false },
    );
    expect(prompt).toContain("District-level price transparency service");
    expect(prompt).toContain("[market-source-1]");
    expect(prompt).toContain("[sol-1]");
  });

  it("tells the model to expect no meaningful opportunity when there is none", () => {
    const prompt = buildUserPrompt(
      "Farmers lack pricing.",
      null,
      stakeholderPain,
      existingSolutions,
      [],
      { queriesExecuted: 0, researchFailures: 0, budgetExhausted: false },
    );
    expect(prompt).toMatch(/did not identify a meaningful opportunity/i);
  });
});
