import { describe, expect, it } from "vitest";

import {
  investmentAgentOutputSchema,
  investmentAnalysisSchema,
  valuationDriversOutputSchema,
} from "./schema";

function calculation() {
  return {
    inputs: [{ label: "potential customers", value: 10000, unit: "count", sourceIds: [] }],
    formula: "potential customers * revenue per customer",
    assumptions: ["Every potential customer converts within year one."],
  };
}

const validInvestmentAnalysis = {
  capitalIntensity: "MODERATE",
  capitalIntensityReasoning: "r",
  initialDevelopmentRequirements: [],
  infrastructureRequirements: [],
  teamRequirements: [],
  operationalRequirements: [],
  deploymentRequirements: [],
  fundingStageRecommendation: "PRE_SEED",
  fundingStageReasoning: "r",
};

describe("investmentAnalysisSchema", () => {
  it("accepts a well-formed analysis", () => {
    expect(investmentAnalysisSchema.safeParse(validInvestmentAnalysis).success).toBe(true);
  });

  it("rejects an invented capital intensity level", () => {
    const result = investmentAnalysisSchema.safeParse({
      ...validInvestmentAnalysis,
      capitalIntensity: "EXTREME",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invented funding stage", () => {
    const result = investmentAnalysisSchema.safeParse({
      ...validInvestmentAnalysis,
      fundingStageRecommendation: "SERIES_A",
    });
    expect(result.success).toBe(false);
  });
});

describe("valuationDriversOutputSchema", () => {
  it("allows a null illustrative scenario", () => {
    const result = valuationDriversOutputSchema.safeParse({
      drivers: [{ driver: "MARKET_SIZE", assessment: "medium", reasoning: "r" }],
      illustrativeScenario: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects VERIFIED as an illustrative scenario status", () => {
    const result = valuationDriversOutputSchema.safeParse({
      drivers: [],
      illustrativeScenario: {
        status: "VERIFIED",
        value: 500_000_000,
        currency: "INR",
        reasoning: "r",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a properly labeled illustrative scenario with a calculation", () => {
    const result = valuationDriversOutputSchema.safeParse({
      drivers: [],
      illustrativeScenario: {
        status: "ILLUSTRATIVE_MODEL_ESTIMATE",
        value: 500_000_000,
        currency: "INR",
        calculation: calculation(),
        reasoning: "r",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("investmentAgentOutputSchema", () => {
  it("accepts an honest 'do not invest yet' output", () => {
    const result = investmentAgentOutputSchema.safeParse({
      investmentAnalysis: validInvestmentAnalysis,
      valuationDrivers: { drivers: [], illustrativeScenario: null },
      investmentRealityCheck: { signal: "BOOTSTRAP_FIRST", explanation: "e" },
      investmentScores: {
        investmentReadiness: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      },
      confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
      validationQuestions: [],
      consultantMessage: "m",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented investment reality signal", () => {
    const result = investmentAgentOutputSchema.safeParse({
      investmentAnalysis: validInvestmentAnalysis,
      valuationDrivers: { drivers: [], illustrativeScenario: null },
      investmentRealityCheck: { signal: "SLAM_DUNK", explanation: "e" },
      investmentScores: {
        investmentReadiness: { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
      },
      confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
      validationQuestions: [],
      consultantMessage: "m",
    });
    expect(result.success).toBe(false);
  });
});
