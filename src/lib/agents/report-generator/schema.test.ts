import { describe, expect, it } from "vitest";

import {
  decisionTraceInputSchema,
  reportGeneratorOutputSchema,
  sectionSummariesSchema,
} from "./schema";

function stage() {
  return { finding: "f", criticalEvidence: [] };
}

function sectionSummary() {
  return { summary: "s", importance: "MEDIUM" as const };
}

function validSectionSummaries() {
  return {
    executiveSummary: sectionSummary(),
    problem: sectionSummary(),
    stakeholders: sectionSummary(),
    pain: sectionSummary(),
    existingSolutions: sectionSummary(),
    gaps: sectionSummary(),
    opportunity: sectionSummary(),
    market: sectionSummary(),
    feasibility: sectionSummary(),
    solution: sectionSummary(),
    architecture: sectionSummary(),
    poc: sectionSummary(),
    implementation: sectionSummary(),
    redTeam: sectionSummary(),
    jury: sectionSummary(),
    assumptions: sectionSummary(),
    validation: sectionSummary(),
    finalVerdict: sectionSummary(),
    nextActions: sectionSummary(),
    evidence: sectionSummary(),
  };
}

function validDecisionTrace() {
  return {
    problem: stage(),
    pain: stage(),
    gap: stage(),
    opportunity: stage(),
    market: stage(),
    feasibility: stage(),
    solution: stage(),
    validation: stage(),
  };
}

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: {
      whatIsTheProblem: "p",
      whoHasTheProblem: "w",
      whyDoesItMatter: "m",
      whatAlreadyExists: "e",
      whatIsMissing: "i",
      whatOpportunityExists: "o",
      canItBeBuilt: "c",
      whatShouldBeBuilt: "b",
      whatIsTheBiggestRisk: "r",
      whatShouldTheTeamDoNext: "n",
    },
    problemContext: "c",
    problemImportantUnknowns: [],
    stakeholderNarrative: "s",
    importantPainLocalIds: ["pain-1"],
    painNarrative: "p",
    importantSolutionLocalIds: ["sol-1"],
    solutionLandscapeNarrative: "s",
    mostImportantGapId: "gap-1",
    gapNarrative: "g",
    opportunityNarrative: "o",
    innovationDirectionSummary: "i",
    aiJustificationSummary: "a",
    marketNarrative: "m",
    feasibilityNarrative: "f",
    solutionArchitectureSummary: "a",
    solutionDataFlowSummary: "d",
    pocNarrative: "p",
    implementationNarrative: "i",
    redTeamSelection: {
      strongestAttackPointId: "rt-1",
      weakestAssumptionId: "assume-1",
      biggestTechnicalRiskValidationId: null,
      biggestMarketRiskValidationId: null,
      biggestAdoptionRiskValidationId: null,
      mostLikelyFailureId: "fm-1",
      mitigation: "m",
    },
    topJuryQuestionIds: ["jq-1"],
    jurySummaryNarrative: "j",
    validationPlanNarrative: "v",
    nextActionPlan: [
      { step: 1, action: "a", reason: "r", expectedOutput: "e", priority: "high" },
    ],
    decisionTrace: validDecisionTrace(),
    majorReasons: ["r1"],
    buildRecommendation: "VALIDATE_BEFORE_BUILD",
    buildRecommendationReasoning: "r",
    sectionSummaries: validSectionSummaries(),
    finalConsultantMessage: "m",
    ...overrides,
  };
}

describe("sectionSummariesSchema", () => {
  it("requires all twenty fixed sections", () => {
    const { evidence, ...missing } = validSectionSummaries();
    void evidence;
    expect(sectionSummariesSchema.safeParse(missing).success).toBe(false);
  });

  it("accepts a fully populated set", () => {
    expect(sectionSummariesSchema.safeParse(validSectionSummaries()).success).toBe(true);
  });
});

describe("decisionTraceInputSchema", () => {
  it("requires all eight fixed stages", () => {
    const { validation, ...missing } = validDecisionTrace();
    void validation;
    expect(decisionTraceInputSchema.safeParse(missing).success).toBe(false);
  });
});

describe("reportGeneratorOutputSchema", () => {
  it("accepts a fully well-formed output", () => {
    expect(reportGeneratorOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("allows a null mostImportantGapId", () => {
    expect(
      reportGeneratorOutputSchema.safeParse(validOutput({ mostImportantGapId: null })).success,
    ).toBe(true);
  });

  it("rejects an empty importantPainLocalIds array", () => {
    expect(
      reportGeneratorOutputSchema.safeParse(validOutput({ importantPainLocalIds: [] })).success,
    ).toBe(false);
  });

  it("rejects an empty nextActionPlan", () => {
    expect(
      reportGeneratorOutputSchema.safeParse(validOutput({ nextActionPlan: [] })).success,
    ).toBe(false);
  });

  it("rejects an invented buildRecommendation", () => {
    expect(
      reportGeneratorOutputSchema.safeParse(validOutput({ buildRecommendation: "SHIP_IT" }))
        .success,
    ).toBe(false);
  });

  it("rejects an empty topJuryQuestionIds array", () => {
    expect(
      reportGeneratorOutputSchema.safeParse(validOutput({ topJuryQuestionIds: [] })).success,
    ).toBe(false);
  });
});
