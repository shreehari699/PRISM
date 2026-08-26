import { describe, expect, it } from "vitest";

import { confidenceLevelSchema } from "./confidence";
import { qualitativeLevelSchema, scoreSchema } from "./scoring";

describe("confidenceLevelSchema", () => {
  it("accepts every documented level, including the honest 'insufficient evidence' case", () => {
    for (const level of ["STRONG", "MODERATE", "WEAK", "INSUFFICIENT_EVIDENCE"]) {
      expect(confidenceLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it("rejects an invented level", () => {
    expect(confidenceLevelSchema.safeParse("CERTAIN").success).toBe(false);
  });
});

describe("qualitativeLevelSchema", () => {
  it("is the same enum scoreSchema.confidence uses", () => {
    const result = scoreSchema.safeParse({
      value: 50,
      basis: "ai_estimate",
      reasoning: "n/a",
      confidence: "medium",
    });
    expect(result.success).toBe(true);
    expect(qualitativeLevelSchema.safeParse("medium").success).toBe(true);
    expect(qualitativeLevelSchema.safeParse("extreme").success).toBe(false);
  });
});
