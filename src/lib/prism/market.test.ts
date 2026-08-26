import { describe, expect, it } from "vitest";

import {
  illustrativeValuationScenarioSchema,
  marketNumberSchema,
} from "./market";

function calculation(overrides: Record<string, unknown> = {}) {
  return {
    inputs: [{ label: "potential customers", value: 10000, unit: "count", sourceIds: [] }],
    formula: "potential customers * revenue per customer",
    assumptions: ["Every potential customer converts within year one."],
    ...overrides,
  };
}

describe("marketNumberSchema", () => {
  it("accepts an UNKNOWN number with a null value", () => {
    const result = marketNumberSchema.safeParse({
      status: "UNKNOWN",
      value: null,
      unit: null,
      currency: null,
      geography: null,
      period: null,
      sourceIds: [],
      confidence: "low",
      reasoning: "No sourced evidence was found for this figure.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an UNKNOWN number that still carries a value", () => {
    const result = marketNumberSchema.safeParse({
      status: "UNKNOWN",
      value: 100,
      unit: "amount",
      currency: null,
      geography: null,
      period: null,
      sourceIds: [],
      confidence: "low",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a VERIFIED number with no cited sources", () => {
    const result = marketNumberSchema.safeParse({
      status: "VERIFIED",
      value: 200_000_000,
      unit: "amount",
      currency: "INR",
      geography: "India",
      period: "2024",
      sourceIds: [],
      confidence: "high",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a VERIFIED number that also carries a calculation", () => {
    const result = marketNumberSchema.safeParse({
      status: "VERIFIED",
      value: 200_000_000,
      unit: "amount",
      currency: "INR",
      geography: "India",
      period: "2024",
      sourceIds: ["source-1"],
      calculation: calculation(),
      confidence: "high",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed VERIFIED number", () => {
    const result = marketNumberSchema.safeParse({
      status: "VERIFIED",
      value: 200_000_000,
      unit: "amount",
      currency: "INR",
      geography: "India",
      period: "2024",
      sourceIds: ["source-1"],
      confidence: "high",
      reasoning: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a MODEL_ESTIMATE with no calculation shown", () => {
    const result = marketNumberSchema.safeParse({
      status: "MODEL_ESTIMATE",
      value: 200_000_000,
      unit: "amount",
      currency: "INR",
      geography: "India",
      period: "2024",
      sourceIds: [],
      confidence: "medium",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed, reproducible MODEL_ESTIMATE", () => {
    const result = marketNumberSchema.safeParse({
      status: "MODEL_ESTIMATE",
      value: 200_000_000,
      unit: "amount",
      currency: "INR",
      geography: "India",
      period: "2024",
      sourceIds: [],
      calculation: calculation(),
      confidence: "medium",
      reasoning: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UNKNOWN number with a null value", () => {
    const result = marketNumberSchema.safeParse({
      status: "MODEL_ESTIMATE",
      value: null,
      unit: null,
      currency: null,
      geography: null,
      period: null,
      sourceIds: [],
      calculation: calculation(),
      confidence: "medium",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("illustrativeValuationScenarioSchema", () => {
  it("rejects VERIFIED as a status entirely — valuation is never presented as verified fact", () => {
    const result = illustrativeValuationScenarioSchema.safeParse({
      status: "VERIFIED",
      value: 500_000_000,
      currency: "INR",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ILLUSTRATIVE_MODEL_ESTIMATE with a calculation", () => {
    const result = illustrativeValuationScenarioSchema.safeParse({
      status: "ILLUSTRATIVE_MODEL_ESTIMATE",
      value: 500_000_000,
      currency: "INR",
      calculation: calculation(),
      reasoning: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an ILLUSTRATIVE_MODEL_ESTIMATE with no calculation shown", () => {
    const result = illustrativeValuationScenarioSchema.safeParse({
      status: "ILLUSTRATIVE_MODEL_ESTIMATE",
      value: 500_000_000,
      currency: "INR",
      reasoning: "x",
    });
    expect(result.success).toBe(false);
  });

  it("accepts UNKNOWN with a null value", () => {
    const result = illustrativeValuationScenarioSchema.safeParse({
      status: "UNKNOWN",
      value: null,
      currency: null,
      reasoning: "Not enough signal to illustrate even a scenario.",
    });
    expect(result.success).toBe(true);
  });
});
