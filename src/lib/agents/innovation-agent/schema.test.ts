import { describe, expect, it } from "vitest";

import {
  aiJustificationSchema,
  innovationAgentOutputSchema,
  innovationAssessmentSchema,
  innovationDirectionSchema,
  opportunityLandscapeEntrySchema,
} from "./schema";

function richClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE",
  sourceIds: string[] = ["source-1"],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function score() {
  return { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" };
}

const validDirection = {
  directionType: "SOFTWARE",
  whyItCouldAddressTheGap: "a",
  whatItWouldChange: "b",
  stakeholderBenefit: "c",
  newCapability: "d",
  assumptionsRequired: [],
  aiJustification: { classification: "AI_OPTIONAL", reasoning: "e" },
};

const validAssessment = {
  opportunityId: "opp-1",
  innovationDirections: [validDirection],
  differentiation: richClaim("ASSUMPTION", []),
  innovationPotential: score(),
  feasibilityPotential: score(),
  refinedOpportunityState: "PROMISING_OPPORTUNITY",
  validationQuestions: [],
};

const validLandscapeEntry = {
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
};

describe("aiJustificationSchema", () => {
  it("accepts a well-formed justification", () => {
    expect(
      aiJustificationSchema.safeParse({ classification: "AI_NOT_JUSTIFIED", reasoning: "y" })
        .success,
    ).toBe(true);
  });

  it("rejects an invented classification", () => {
    expect(
      aiJustificationSchema.safeParse({ classification: "AI_MANDATORY", reasoning: "y" })
        .success,
    ).toBe(false);
  });
});

describe("innovationDirectionSchema", () => {
  it("accepts a well-formed direction", () => {
    expect(innovationDirectionSchema.safeParse(validDirection).success).toBe(true);
  });

  it("rejects an invented directionType", () => {
    const result = innovationDirectionSchema.safeParse({
      ...validDirection,
      directionType: "MAGIC",
    });
    expect(result.success).toBe(false);
  });
});

describe("innovationAssessmentSchema", () => {
  it("accepts a well-formed assessment", () => {
    expect(innovationAssessmentSchema.safeParse(validAssessment).success).toBe(true);
  });

  it("allows an empty innovationDirections list", () => {
    const result = innovationAssessmentSchema.safeParse({
      ...validAssessment,
      innovationDirections: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a VERIFIED differentiation claim with no cited sources", () => {
    const result = innovationAssessmentSchema.safeParse({
      ...validAssessment,
      differentiation: richClaim("VERIFIED", []),
    });
    expect(result.success).toBe(false);
  });
});

describe("opportunityLandscapeEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(opportunityLandscapeEntrySchema.safeParse(validLandscapeEntry).success).toBe(true);
  });

  it("rejects an invented qualitative level", () => {
    const result = opportunityLandscapeEntrySchema.safeParse({
      ...validLandscapeEntry,
      stakeholderValue: "extreme",
    });
    expect(result.success).toBe(false);
  });
});

describe("innovationAgentOutputSchema", () => {
  it("allows fully empty output — no viable opportunity is a valid result", () => {
    const result = innovationAgentOutputSchema.safeParse({
      assessments: [],
      opportunityLandscape: [],
      opportunityRealityCheck: { signal: "NO_CLEAR_OPPORTUNITY", explanation: "e" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed output", () => {
    const result = innovationAgentOutputSchema.safeParse({
      assessments: [validAssessment],
      opportunityLandscape: [validLandscapeEntry],
      opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented reality check signal", () => {
    const result = innovationAgentOutputSchema.safeParse({
      assessments: [],
      opportunityLandscape: [],
      opportunityRealityCheck: { signal: "GUARANTEED", explanation: "e" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(false);
  });
});
