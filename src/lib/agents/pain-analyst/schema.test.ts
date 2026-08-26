import { describe, expect, it } from "vitest";

import { painAnalystOutputSchema, painPointSchema, painSeverityScoreSchema } from "./schema";

function claim(status: "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE") {
  return { claim: "x", status, reasoning: "y" };
}

const validSeverityScore = {
  dimensions: {
    severity: 70,
    frequency: 60,
    reach: 50,
    consequence: 65,
    urgency: 55,
    currentSolutionSatisfaction: 20,
  },
  overall: {
    value: 62,
    basis: "ai_estimate",
    reasoning: "Weighted mostly on severity and consequence.",
    confidence: "medium",
  },
};

const validPainPoint = {
  localId: "pain-price-opacity",
  stakeholderLocalId: "farmer",
  painTitle: "No visibility into fair price before selling",
  description: "Farmers sell blind at harvest time.",
  cause: claim(),
  frequency: claim("UNKNOWN"),
  riskIfUnsolved: claim("ASSUMPTION"),
  severityScore: validSeverityScore,
  confidence: "medium",
};

describe("painSeverityScoreSchema", () => {
  it("accepts well-formed dimensions with a reasoned overall score", () => {
    expect(painSeverityScoreSchema.safeParse(validSeverityScore).success).toBe(true);
  });

  it("rejects a dimension outside 0-100", () => {
    const result = painSeverityScoreSchema.safeParse({
      ...validSeverityScore,
      dimensions: { ...validSeverityScore.dimensions, severity: 150 },
    });
    expect(result.success).toBe(false);
  });

  it("requires the overall score to carry reasoning and basis, not a bare number", () => {
    const result = painSeverityScoreSchema.safeParse({
      ...validSeverityScore,
      overall: { value: 62 },
    });
    expect(result.success).toBe(false);
  });
});

describe("painPointSchema", () => {
  it("accepts a minimal well-formed pain point", () => {
    expect(painPointSchema.safeParse(validPainPoint).success).toBe(true);
  });

  it("allows optional effect fields to be omitted entirely", () => {
    const result = painPointSchema.safeParse(validPainPoint);
    expect(result.success).toBe(true);
  });

  it("accepts UNKNOWN as a claim status when evidence is unavailable", () => {
    const result = painPointSchema.parse(validPainPoint);
    expect(result.frequency.status).toBe("UNKNOWN");
  });

  it("defaults evidenceClaims to an empty array", () => {
    const result = painPointSchema.parse(validPainPoint);
    expect(result.evidenceClaims).toEqual([]);
  });
});

describe("painAnalystOutputSchema", () => {
  const validOutput = {
    painPoints: [validPainPoint],
    primaryPain: { painLocalId: "pain-price-opacity", reasoning: "Root cause, not a symptom." },
    customerDistinction: { applicable: false, notes: [] },
    validationQuestions: ["How frequently does this pain occur?"],
    realityCheck: {
      stakeholderConfidence: "MODERATE",
      painConfidence: "MODERATE",
      primaryPainConfidence: "WEAK",
      evidenceCompleteness: "INSUFFICIENT_EVIDENCE",
      summary: "We could not confidently determine frequency without user interviews.",
    },
    consultantMessage: "This pain looks real, but we don't yet know how often it bites.",
  };

  it("accepts a well-formed output, including an honest INSUFFICIENT_EVIDENCE reality check", () => {
    expect(painAnalystOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("requires at least one pain point", () => {
    const result = painAnalystOutputSchema.safeParse({ ...validOutput, painPoints: [] });
    expect(result.success).toBe(false);
  });

  it("requires at least one validation question", () => {
    const result = painAnalystOutputSchema.safeParse({
      ...validOutput,
      validationQuestions: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires primaryPain reasoning, not just a bare pointer", () => {
    const result = painAnalystOutputSchema.safeParse({
      ...validOutput,
      primaryPain: { painLocalId: "pain-price-opacity" },
    });
    expect(result.success).toBe(false);
  });

  it("defaults secondaryPains and downstreamConsequences to empty arrays", () => {
    const result = painAnalystOutputSchema.parse(validOutput);
    expect(result.secondaryPains).toEqual([]);
    expect(result.downstreamConsequences).toEqual([]);
  });
});
