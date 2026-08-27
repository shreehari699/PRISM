import { describe, expect, it } from "vitest";

import {
  assumptionSchema,
  counterSolutionAnalysisSchema,
  juryPanelSchema,
  redTeamPointSchema,
  validationAgentOutputSchema,
  validationClaimSchema,
  validationScoresSchema,
} from "./schema";

function score() {
  return { value: 40, basis: "ai_estimate" as const, reasoning: "n/a", confidence: "low" as const };
}

function juryReview() {
  return {
    strengths: ["s"],
    questions: ["q"],
    concerns: ["c"],
    criticalQuestion: "cq",
    scoreOrAssessment: score(),
    reasoning: "r",
    confidence: "medium" as const,
  };
}

function validClaim(overrides: Record<string, unknown> = {}) {
  return {
    validationId: "val-1",
    domain: "PROBLEM_VALIDATION",
    claim: "c",
    question: "q",
    evidence: "e",
    evidenceStatus: "ASSUMPTION",
    sourceIds: [],
    finding: "f",
    confidence: "medium",
    severity: "medium",
    recommendedAction: "a",
    ...overrides,
  };
}

function validAssumption(overrides: Record<string, unknown> = {}) {
  return {
    assumptionId: "assume-1",
    assumption: "a",
    category: "MARKET",
    whyItMatters: "w",
    dependency: "d",
    confidence: "medium",
    validationMethod: "m",
    failureImpact: "f",
    status: "UNKNOWN",
    ...overrides,
  };
}

function validRedTeamPoint(overrides: Record<string, unknown> = {}) {
  return {
    pointId: "rt-1",
    argument: "a",
    category: "HYPOTHETICAL",
    targetArea: "t",
    severity: "medium",
    sourceIds: [],
    ...overrides,
  };
}

function counterSolutionOption() {
  return { description: "d", addressesCoreProblem: "a", tradeoffs: "t" };
}

function unknownNumber() {
  return {
    status: "UNKNOWN" as const,
    value: null,
    unit: null,
    currency: null,
    geography: null,
    period: null,
    sourceIds: [],
    calculation: null,
    confidence: "low" as const,
    reasoning: "n/a",
  };
}

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    validationClaims: [validClaim()],
    assumptionRegister: [validAssumption()],
    redTeamReview: {
      points: [validRedTeamPoint()],
      mostFragileAssumptionId: "assume-1",
      hiddenDependencies: [],
      keyTechnologyFailureImpact: null,
      summary: "s",
    },
    jury: {
      technicalJudge: juryReview(),
      domainExpert: juryReview(),
      businessJudge: juryReview(),
      impactJudge: juryReview(),
      productJudge: juryReview(),
    },
    juryQuestions: [
      {
        questionId: "jq-1",
        question: "q",
        bestAnswer: "a",
        evidence: "e",
        sourceIds: [],
        confidence: "medium",
        answerStatus: "UNKNOWN",
      },
    ],
    failureModes: [
      {
        failureId: "fm-1",
        failure: "f",
        cause: "c",
        impact: "i",
        likelihood: "medium",
        severity: "medium",
        detection: "d",
        mitigation: "m",
        fallback: "fb",
        basis: "ai_estimate",
        confidence: "low",
      },
    ],
    preMortem: {
      scenario: "s",
      entries: [
        { failureReason: "r", earlyWarningSignal: "w", preventiveAction: "p", fallback: "f" },
      ],
    },
    counterSolutionAnalysis: {
      simplestAlternative: "s",
      recommended: counterSolutionOption(),
      simpler: counterSolutionOption(),
      existing: counterSolutionOption(),
      manualWorkaround: counterSolutionOption(),
      conclusion: "RECOMMENDED_SOLUTION_JUSTIFIED",
      reasoning: "r",
    },
    buildRecommendation: "VALIDATE_BEFORE_BUILD",
    buildRecommendationReasoning: "r",
    validationPlan: [
      {
        validationId: "exp-1",
        hypothesis: "h",
        method: "m",
        participantsOrData: "p",
        measurement: "m",
        successCriteria: ["works"],
        failureCriteria: ["doesn't"],
        estimatedEffort: unknownNumber(),
        priority: "medium",
      },
    ],
    pocValidation: { status: "POC_INSUFFICIENT", explanation: "e" },
    successMetricsReview: {
      wellDefined: false,
      measurable: false,
      relevant: false,
      realistic: false,
      explanation: "e",
    },
    criticalAssumption: { assumptionId: "assume-1", reasoning: "r" },
    validationScores: {
      problemConfidence: score(),
      solutionConfidence: score(),
      marketConfidence: score(),
      technicalConfidence: score(),
      adoptionConfidence: score(),
      evidenceConfidence: score(),
    },
    evidenceSummary: { narrative: "n/a" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("validationClaimSchema", () => {
  it("accepts a well-formed ASSUMPTION claim with no sources", () => {
    expect(validationClaimSchema.safeParse(validClaim()).success).toBe(true);
  });

  it("rejects a VERIFIED claim with no cited sources", () => {
    const result = validationClaimSchema.safeParse(
      validClaim({ evidenceStatus: "VERIFIED", sourceIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a PARTIALLY_SUPPORTED claim with no cited sources", () => {
    const result = validationClaimSchema.safeParse(
      validClaim({ evidenceStatus: "PARTIALLY_SUPPORTED", sourceIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a VERIFIED claim once a source is cited", () => {
    const result = validationClaimSchema.safeParse(
      validClaim({ evidenceStatus: "VERIFIED", sourceIds: ["source-1"] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invented domain", () => {
    const result = validationClaimSchema.safeParse(validClaim({ domain: "VIBES_VALIDATION" }));
    expect(result.success).toBe(false);
  });
});

describe("assumptionSchema", () => {
  it("accepts a well-formed assumption", () => {
    expect(assumptionSchema.safeParse(validAssumption()).success).toBe(true);
  });

  it("rejects an invented category", () => {
    expect(assumptionSchema.safeParse(validAssumption({ category: "VIBES" })).success).toBe(
      false,
    );
  });

  it("rejects an invented status", () => {
    expect(assumptionSchema.safeParse(validAssumption({ status: "PROBABLY_FINE" })).success).toBe(
      false,
    );
  });
});

describe("redTeamPointSchema", () => {
  it("rejects an EVIDENCE_BACKED point with no cited sources", () => {
    const result = redTeamPointSchema.safeParse(
      validRedTeamPoint({ category: "EVIDENCE_BACKED", sourceIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts an EVIDENCE_BACKED point once a source is cited", () => {
    const result = redTeamPointSchema.safeParse(
      validRedTeamPoint({ category: "EVIDENCE_BACKED", sourceIds: ["source-1"] }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a HYPOTHETICAL point with no sources", () => {
    expect(redTeamPointSchema.safeParse(validRedTeamPoint()).success).toBe(true);
  });
});

describe("juryPanelSchema", () => {
  it("rejects a panel missing one of the five fixed perspectives", () => {
    const panel = {
      technicalJudge: juryReview(),
      domainExpert: juryReview(),
      businessJudge: juryReview(),
      impactJudge: juryReview(),
      // productJudge omitted
    };
    expect(juryPanelSchema.safeParse(panel).success).toBe(false);
  });
});

describe("counterSolutionAnalysisSchema", () => {
  it("accepts SIMPLER_SOLUTION_PREFERRED as a valid conclusion", () => {
    const analysis = {
      simplestAlternative: "s",
      recommended: counterSolutionOption(),
      simpler: counterSolutionOption(),
      existing: counterSolutionOption(),
      manualWorkaround: counterSolutionOption(),
      conclusion: "SIMPLER_SOLUTION_PREFERRED",
      reasoning: "r",
    };
    expect(counterSolutionAnalysisSchema.safeParse(analysis).success).toBe(true);
  });

  it("rejects an invented conclusion", () => {
    const analysis = {
      simplestAlternative: "s",
      recommended: counterSolutionOption(),
      simpler: counterSolutionOption(),
      existing: counterSolutionOption(),
      manualWorkaround: counterSolutionOption(),
      conclusion: "BUILD_BOTH",
      reasoning: "r",
    };
    expect(counterSolutionAnalysisSchema.safeParse(analysis).success).toBe(false);
  });
});

describe("validationScoresSchema", () => {
  it("requires all six fixed dimensions", () => {
    const scores = {
      problemConfidence: score(),
      solutionConfidence: score(),
      marketConfidence: score(),
      technicalConfidence: score(),
      adoptionConfidence: score(),
      // evidenceConfidence omitted
    };
    expect(validationScoresSchema.safeParse(scores).success).toBe(false);
  });
});

describe("validationAgentOutputSchema", () => {
  it("accepts a fully well-formed output", () => {
    const result = validationAgentOutputSchema.safeParse(validOutput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty assumptionRegister", () => {
    const result = validationAgentOutputSchema.safeParse(
      validOutput({ assumptionRegister: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty validationPlan", () => {
    const result = validationAgentOutputSchema.safeParse(validOutput({ validationPlan: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invented buildRecommendation", () => {
    const result = validationAgentOutputSchema.safeParse(
      validOutput({ buildRecommendation: "SHIP_IT" }),
    );
    expect(result.success).toBe(false);
  });
});
