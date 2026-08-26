import { describe, expect, it } from "vitest";

import {
  competitiveLandscapeSchema,
  competitorEntrySchema,
  marketAgentOutputSchema,
  marketSegmentEntrySchema,
  marketSizeAnalysisSchema,
  roleAssignmentSchema,
  scalabilitySchema,
  unitEconomicsSchema,
} from "./schema";

function richClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function unknownNumber() {
  return {
    status: "UNKNOWN",
    value: null,
    unit: null,
    currency: null,
    geography: null,
    period: null,
    sourceIds: [],
    confidence: "low",
    reasoning: "No evidence available.",
  };
}

function scalabilityAssessment() {
  return { level: "UNKNOWN", reasoning: "n/a" };
}

describe("roleAssignmentSchema", () => {
  it("accepts a stakeholder with more than one role", () => {
    const result = roleAssignmentSchema.safeParse({
      stakeholderRef: "farmer",
      roles: ["USER", "BENEFICIARY"],
      reasoning: "The farmer both uses the app and benefits from better prices.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented role", () => {
    const result = roleAssignmentSchema.safeParse({
      stakeholderRef: "farmer",
      roles: ["SHAREHOLDER"],
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty roles list", () => {
    const result = roleAssignmentSchema.safeParse({
      stakeholderRef: "farmer",
      roles: [],
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });
});

describe("marketSegmentEntrySchema", () => {
  it("rejects an invented segment category", () => {
    const result = marketSegmentEntrySchema.safeParse({
      segment: "METAVERSE",
      need: "a",
      buyer: "b",
      user: "c",
      pain: "d",
      adoptionBarrier: "e",
      opportunityRelevance: "medium",
      confidence: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed segment", () => {
    const result = marketSegmentEntrySchema.safeParse({
      segment: "AGRICULTURE",
      need: "a",
      buyer: "b",
      user: "c",
      pain: "d",
      adoptionBarrier: "e",
      opportunityRelevance: "medium",
      confidence: "medium",
    });
    expect(result.success).toBe(true);
  });
});

describe("competitorEntrySchema", () => {
  it("accepts a well-formed competitor", () => {
    const result = competitorEntrySchema.safeParse({
      name: "eNAM",
      organization: "Government of India",
      solution: "National trading platform",
      targetCustomer: "Farmers",
      classification: "DIRECT",
      strength: richClaim("VERIFIED", ["source-1"]),
      limitation: richClaim("INFERENCE"),
      marketPositionIfVerified: richClaim("ASSUMPTION"),
      sourceIds: ["source-1"],
      confidence: "medium",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented classification", () => {
    const result = competitorEntrySchema.safeParse({
      name: "eNAM",
      organization: "Government of India",
      solution: "National trading platform",
      targetCustomer: "Farmers",
      classification: "FRENEMY",
      strength: richClaim(),
      limitation: richClaim(),
      marketPositionIfVerified: richClaim(),
      sourceIds: [],
      confidence: "medium",
    });
    expect(result.success).toBe(false);
  });
});

describe("competitiveLandscapeSchema", () => {
  it("rejects a VERIFIED 'no competitors' summary with zero cited sources", () => {
    const result = competitiveLandscapeSchema.safeParse({
      competitors: [],
      summary: richClaim("VERIFIED", []),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an honest ASSUMPTION-based 'no competitors identified yet' summary", () => {
    const result = competitiveLandscapeSchema.safeParse({
      competitors: [],
      summary: richClaim("ASSUMPTION", []),
    });
    expect(result.success).toBe(true);
  });
});

describe("marketSizeAnalysisSchema", () => {
  it("accepts an UNKNOWN market size with a scope definition", () => {
    const result = marketSizeAnalysisSchema.safeParse({
      definition: "Digital crop-pricing platforms for Indian smallholder farmers.",
      value: unknownNumber(),
    });
    expect(result.success).toBe(true);
  });
});

describe("unitEconomicsSchema", () => {
  it("requires every field to be an explicit marketNumber, not omitted", () => {
    const result = unitEconomicsSchema.safeParse({
      customerAcquisitionCost: unknownNumber(),
      revenuePerCustomer: unknownNumber(),
      grossMargin: unknownNumber(),
      operationalCost: unknownNumber(),
      supportCost: unknownNumber(),
      infrastructureCost: unknownNumber(),
      paybackPeriod: unknownNumber(),
      narrative: "No sourced unit economics evidence exists yet.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing field rather than defaulting it", () => {
    const result = unitEconomicsSchema.safeParse({
      customerAcquisitionCost: unknownNumber(),
      revenuePerCustomer: unknownNumber(),
      grossMargin: unknownNumber(),
      operationalCost: unknownNumber(),
      supportCost: unknownNumber(),
      narrative: "n",
    });
    expect(result.success).toBe(false);
  });
});

describe("scalabilitySchema", () => {
  it("requires all seven dimensions", () => {
    const result = scalabilitySchema.safeParse({
      technical: scalabilityAssessment(),
      operational: scalabilityAssessment(),
      geographic: scalabilityAssessment(),
      customer: scalabilityAssessment(),
      support: scalabilityAssessment(),
      regulatory: scalabilityAssessment(),
      data: scalabilityAssessment(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing dimension", () => {
    const result = scalabilitySchema.safeParse({
      technical: scalabilityAssessment(),
      operational: scalabilityAssessment(),
      geographic: scalabilityAssessment(),
      customer: scalabilityAssessment(),
      support: scalabilityAssessment(),
      regulatory: scalabilityAssessment(),
    });
    expect(result.success).toBe(false);
  });
});

describe("marketAgentOutputSchema", () => {
  it("accepts a fully honest, evidence-thin output — INSUFFICIENT_EVIDENCE is valid", () => {
    const result = marketAgentOutputSchema.safeParse({
      marketSummary: "s",
      customerModel: null,
      marketSegments: [],
      competitiveLandscape: { competitors: [], summary: richClaim("ASSUMPTION", []) },
      marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
      adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "n/a" },
      tamAnalysis: { definition: "n/a", value: unknownNumber() },
      samAnalysis: { definition: "n/a", value: unknownNumber() },
      somAnalysis: { definition: "n/a", value: unknownNumber() },
      businessModels: [],
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
        technical: scalabilityAssessment(),
        operational: scalabilityAssessment(),
        geographic: scalabilityAssessment(),
        customer: scalabilityAssessment(),
        support: scalabilityAssessment(),
        regulatory: scalabilityAssessment(),
        data: scalabilityAssessment(),
      },
      marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
      marketScores: {
        marketPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
        commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
        adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
        scalability: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      },
      validationQuestions: [],
    });
    expect(result.success).toBe(true);
  });
});
