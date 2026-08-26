import { describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runMarketAgent } from "./index";
import type { MarketEvidenceSourceInput } from "./prompt";
import { marketAgentOutputSchema } from "./schema";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
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
  differentiation: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
  innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  validationQuestions: [],
};

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

const sources: MarketEvidenceSourceInput[] = [];
const researchSummary = { queriesExecuted: 0, researchFailures: 0, budgetExhausted: false };

function context(upstream: { stakeholderPain?: unknown; existingSolutions?: unknown }) {
  return {
    phaseKey: "market_investment" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      stakeholder_pain: upstream.stakeholderPain,
      existing_solutions: upstream.existingSolutions,
    },
    userId: "user-1",
  };
}

const validOutput = {
  marketSummary: "s",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "n/a" },
  tamAnalysis: { definition: "n/a", value: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" } },
  samAnalysis: { definition: "n/a", value: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" } },
  somAnalysis: { definition: "n/a", value: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" } },
  businessModels: [],
  unitEconomics: {
    customerAcquisitionCost: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    revenuePerCustomer: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    grossMargin: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    operationalCost: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    supportCost: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    infrastructureCost: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
    paybackPeriod: { status: "UNKNOWN", value: null, unit: null, currency: null, geography: null, period: null, sourceIds: [], confidence: "low", reasoning: "n/a" },
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
  marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  marketScores: {
    marketPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  validationQuestions: [],
};

describe("runMarketAgent", () => {
  it("returns an error without calling the provider when Phase 02 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runMarketAgent(
      context({ existingSolutions: validExistingSolutions }),
      leadingOpportunity,
      sources,
      researchSummary,
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 03 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runMarketAgent(
      context({ stakeholderPain: validStakeholderPain }),
      leadingOpportunity,
      sources,
      researchSummary,
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with the market agent schema when upstream phases are valid", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runMarketAgent(
      context({ stakeholderPain: validStakeholderPain, existingSolutions: validExistingSolutions }),
      leadingOpportunity,
      sources,
      researchSummary,
      provider,
    );

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: marketAgentOutputSchema }),
    );
  });

  it("runs cleanly when there is no leading opportunity", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runMarketAgent(
      context({ stakeholderPain: validStakeholderPain, existingSolutions: validExistingSolutions }),
      null,
      sources,
      researchSummary,
      provider,
    );

    expect(result.status).toBe("ok");
  });
});
