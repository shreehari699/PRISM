import { describe, expect, it } from "vitest";

import { existingSolutionSchema, solutionExtractorOutputSchema } from "./schema";

function claim(status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "VERIFIED") {
  return { claim: "x", status, reasoning: "y" };
}

const validSolution = {
  localId: "sol-1",
  name: "eNAM",
  organization: "Government of India",
  country: "India",
  yearIfVerified: "2016",
  solutionType: "GOVERNMENT_PROGRAM",
  problemAddressed: claim(),
  howItWorks: claim("INFERENCE"),
  deploymentStatus: "ACTIVE",
  businessModelIfKnown: "UNKNOWN",
  sourceIds: ["source-1"],
  confidence: "medium",
  costInformation: "UNKNOWN",
  geographicCoverage: "India",
  evidenceConfidence: "medium",
};

describe("existingSolutionSchema", () => {
  it("accepts a well-formed solution", () => {
    expect(existingSolutionSchema.safeParse(validSolution).success).toBe(true);
  });

  it("requires at least one sourceId — a solution can't exist with zero evidence", () => {
    const result = existingSolutionSchema.safeParse({ ...validSolution, sourceIds: [] });
    expect(result.success).toBe(false);
  });

  it("accepts the literal string UNKNOWN for unresolved descriptive fields", () => {
    const result = existingSolutionSchema.parse(validSolution);
    expect(result.businessModelIfKnown).toBe("UNKNOWN");
    expect(result.costInformation).toBe("UNKNOWN");
  });

  it("rejects an invented solutionType", () => {
    const result = existingSolutionSchema.safeParse({
      ...validSolution,
      solutionType: "NON_PROFIT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invented deploymentStatus", () => {
    const result = existingSolutionSchema.safeParse({
      ...validSolution,
      deploymentStatus: "RUMORED",
    });
    expect(result.success).toBe(false);
  });

  it("defaults strengths, limitations, and evidenceClaims to empty arrays", () => {
    const result = existingSolutionSchema.parse(validSolution);
    expect(result.strengths).toEqual([]);
    expect(result.limitations).toEqual([]);
    expect(result.evidenceClaims).toEqual([]);
  });
});

describe("solutionExtractorOutputSchema", () => {
  it("allows zero solutions — a genuine green field is a valid, honest result", () => {
    const result = solutionExtractorOutputSchema.safeParse({
      solutions: [],
      consultantMessage: "We found no credible existing solutions in this research batch.",
    });
    expect(result.success).toBe(true);
  });

  it("requires a consultant message", () => {
    const result = solutionExtractorOutputSchema.safeParse({ solutions: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed output with solutions", () => {
    const result = solutionExtractorOutputSchema.safeParse({
      solutions: [validSolution],
      consultantMessage: "One government platform surfaced; no commercial players yet.",
    });
    expect(result.success).toBe(true);
  });
});
