import { describe, expect, it } from "vitest";

import {
  draftOpportunitySchema,
  opportunityAgentOutputSchema,
  whyNowFactorSchema,
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

const validOpportunity = {
  opportunityId: "opp-1",
  title: "District-level price transparency service",
  description: "d",
  unservedNeed: richClaim(),
  affectedStakeholders: ["farmer"],
  relatedPains: ["pain-1"],
  relatedGaps: ["gap-1"],
  existingSolutionContext: richClaim("ASSUMPTION", []),
  whyNow: { factors: [], summary: "s" },
  impact: [],
  valuePotential: score(),
  impactPotential: score(),
  confidence: "medium",
  opportunityState: "PROMISING_OPPORTUNITY",
};

describe("whyNowFactorSchema", () => {
  it("accepts a well-formed factor", () => {
    const result = whyNowFactorSchema.safeParse({
      factor: "TECHNOLOGY_READINESS",
      claim: "Smartphone penetration has increased.",
      status: "ASSUMPTION",
      reasoning: "Not directly evidenced upstream.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented factor type", () => {
    const result = whyNowFactorSchema.safeParse({
      factor: "ASTROLOGICAL_ALIGNMENT",
      claim: "x",
      status: "ASSUMPTION",
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });
});

describe("draftOpportunitySchema", () => {
  it("accepts a well-formed opportunity", () => {
    expect(draftOpportunitySchema.safeParse(validOpportunity).success).toBe(true);
  });

  it("rejects an invented opportunityState", () => {
    const result = draftOpportunitySchema.safeParse({
      ...validOpportunity,
      opportunityState: "GUARANTEED_OPPORTUNITY",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a VERIFIED unservedNeed claim with no sources", () => {
    const result = draftOpportunitySchema.safeParse({
      ...validOpportunity,
      unservedNeed: richClaim("VERIFIED", []),
    });
    expect(result.success).toBe(false);
  });

  it("defaults impact and evidenceClaims to empty arrays", () => {
    const result = draftOpportunitySchema.parse(validOpportunity);
    expect(result.impact).toEqual([]);
    expect(result.evidenceClaims).toEqual([]);
  });
});

describe("opportunityAgentOutputSchema", () => {
  it("allows an empty opportunities list — no meaningful opportunity is a valid result", () => {
    const result = opportunityAgentOutputSchema.safeParse({ opportunities: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed output", () => {
    const result = opportunityAgentOutputSchema.safeParse({
      opportunities: [validOpportunity],
    });
    expect(result.success).toBe(true);
  });
});
