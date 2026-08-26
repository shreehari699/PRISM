import { describe, expect, it } from "vitest";

import { decisionRecommendationSchema, finalDecisionSchema } from "./decision";
import { evidenceClaimSchema, evidenceStatusSchema } from "./evidence";
import { MODE_CRITERIA, projectModeSchema } from "./modes";
import { scoreSchema } from "./scoring";

describe("evidenceStatusSchema", () => {
  it("accepts every documented status", () => {
    for (const status of [
      "VERIFIED",
      "INFERENCE",
      "ASSUMPTION",
      "RECOMMENDATION",
      "UNKNOWN",
    ]) {
      expect(evidenceStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects an invented status", () => {
    expect(evidenceStatusSchema.safeParse("CONFIRMED").success).toBe(false);
  });
});

describe("evidenceClaimSchema", () => {
  it("requires reasoning alongside every claim", () => {
    const result = evidenceClaimSchema.safeParse({
      claim: "The market is growing.",
      status: "ASSUMPTION",
      reasoning: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("scoreSchema", () => {
  it("requires a basis and reasoning — never a bare number", () => {
    const result = scoreSchema.safeParse({ value: 80 });
    expect(result.success).toBe(false);
  });

  it("rejects a value outside 0-100", () => {
    const result = scoreSchema.safeParse({
      value: 150,
      basis: "ai_estimate",
      reasoning: "n/a",
      confidence: "low",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed score", () => {
    const result = scoreSchema.safeParse({
      value: 64,
      basis: "heuristic",
      reasoning: "Based on stakeholder count and severity average.",
      confidence: "medium",
    });
    expect(result.success).toBe(true);
  });
});

describe("finalDecisionSchema / decisionRecommendationSchema", () => {
  it("is not biased toward BUILD — every option is equally valid input", () => {
    for (const decision of ["BUILD", "RESEARCH_FURTHER", "PARK", "REJECT"]) {
      expect(finalDecisionSchema.safeParse(decision).success).toBe(true);
    }
  });

  it("requires reasoning for a recommendation", () => {
    const result = decisionRecommendationSchema.safeParse({
      decision: "REJECT",
      reasoning: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults reconsiderIf to an empty array", () => {
    const result = decisionRecommendationSchema.parse({
      decision: "PARK",
      reasoning: "No urgent stakeholder demand found.",
    });
    expect(result.reconsiderIf).toEqual([]);
  });
});

describe("projectModeSchema / MODE_CRITERIA", () => {
  it("has criteria defined for every project mode", () => {
    const modes = projectModeSchema.options;
    for (const mode of modes) {
      expect(MODE_CRITERIA[mode].length).toBeGreaterThan(0);
    }
  });
});
