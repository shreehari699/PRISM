import { describe, expect, it } from "vitest";

import type { MarketEvidenceSourceInput } from "@/lib/agents/market-agent/prompt";
import type { MarketAgentOutput } from "@/lib/agents/market-agent/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";

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

const marketAnalysis: MarketAgentOutput = {
  marketSummary: "The market for district-level price transparency is early but plausible.",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "No verified competitors found.", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "MEDIUM", reasoning: "Procurement cycles are slow." },
  tamAnalysis: { definition: "n/a", value: unknownNumber() },
  samAnalysis: { definition: "n/a", value: unknownNumber() },
  somAnalysis: { definition: "n/a", value: unknownNumber() },
  businessModels: [
    {
      model: "B2G_CONTRACT",
      whyItFits: "y",
      whoPays: "State agriculture department",
      pricingHypothesis: unknownNumber(),
      costDriver: "y",
      adoptionFriction: "y",
      confidence: "low",
    },
  ],
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
  marketRealityCheck: { signal: "EARLY_MARKET", explanation: "e" },
  marketScores: {
    marketPotential: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 30, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 35, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
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

describe("buildSystemInstruction (Investment Agent)", () => {
  it("forbids manufacturing a positive investment case", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/Do not manufacture a positive investment case/);
  });

  it("forbids stating an exact valuation as fact", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/NEVER state an exact valuation as fact/);
    expect(instruction).toMatch(/ILLUSTRATIVE_MODEL_ESTIMATE/);
  });

  // Latent instance of the Phase 05 GAP-001 bug class: `sourceIds` on a
  // calculation input is validated against real evidence source ids by
  // the composer, but this agent's prompt never told the model that
  // explicitly and never showed it the real list.
  it("forbids citing a non-evidence id in a calculation input's sourceIds", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/never a gap id, opportunity id, or any other id from a different phase/i);
  });
});

describe("buildUserPrompt (Investment Agent)", () => {
  it("embeds the market analysis summary and TAM/SAM/SOM", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", leadingOpportunity, marketAnalysis, sources);
    expect(prompt).toContain("district-level price transparency");
    expect(prompt).toContain("EARLY_MARKET");
  });

  it("notes when there is no leading opportunity", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", null, marketAnalysis, sources);
    expect(prompt).toMatch(/did not identify a meaningful opportunity/i);
  });

  it("shows the real evidence source ids so the model has something valid to cite in sourceIds", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", leadingOpportunity, marketAnalysis, sources);
    expect(prompt).toContain("[source-1]");
    expect(prompt).toMatch(/evidence sources[\s\S]*only valid values for any `sourceIds`/i);
  });

  it("tells the model explicitly when no sources exist, rather than leaving it to guess", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", leadingOpportunity, marketAnalysis, []);
    expect(prompt).toMatch(/no evidence sources are available/i);
    expect(prompt).toMatch(/sourceIds[\s\S]*must stay empty/i);
  });
});
