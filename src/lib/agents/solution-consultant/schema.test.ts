import { describe, expect, it } from "vitest";

import {
  dataFlowSchema,
  featureScopeSchema,
  implementationStepSchema,
  modeSolutionPlanSchema,
  pocDefinitionSchema,
  solutionConsultantOutputSchema,
  solutionRiskSchema,
  solutionSchema,
  successMetricSchema,
  userJourneyStageSchema,
} from "./schema";

function richClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
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

function dataFlowStage() {
  return { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" };
}

const validSolution = {
  solutionId: "sol-1",
  name: "PriceLens",
  tagline: "t",
  executiveSummary: "s",
  problemAddressed: richClaim(),
  primaryUsers: ["farmer"],
  customers: [],
  beneficiaries: ["farmer"],
  coreValueProposition: "v",
  validatedGapId: "gap-1",
  opportunityId: "opp-1",
  differentiation: {
    genuinelyDifferent: "a",
    incremental: "b",
    defensible: "c",
    merelyAFeature: "d",
    overallClaim: richClaim("ASSUMPTION"),
  },
  solutionType: "SOFTWARE",
  technologyApproach: "t",
  aiRole: {
    classification: "AI_NOT_REQUIRED",
    whyAiIsNeeded: "n/a",
    whatAiDoes: "n/a",
    whatAiDoesNot: "n/a",
    reasoning: "y",
  },
  hardwareRole: null,
  softwareRole: "s",
  dataRole: "d",
  workflow: ["step 1"],
  architecture: {
    inputs: [],
    processing: [],
    aiComponents: [],
    deterministicComponents: [],
    database: [],
    externalApis: [],
    hardware: [],
    outputs: [],
  },
  userJourney: [{ stage: "START", description: "d" }],
  coreFeatures: [],
  mustHaveFeatures: [],
  futureFeatures: [],
  implementationPlan: [
    {
      stepNumber: 0,
      objective: "o",
      deliverable: "d",
      dependency: "n/a",
      estimatedEffort: unknownNumber(),
      risk: "n/a",
      completionCondition: "c",
    },
  ],
  risks: [],
  limitations: [],
  evidenceClaims: [],
  confidence: "medium",
};

describe("solutionSchema", () => {
  it("accepts a well-formed solution", () => {
    expect(solutionSchema.safeParse(validSolution).success).toBe(true);
  });

  it("rejects an invented solutionType", () => {
    const result = solutionSchema.safeParse({ ...validSolution, solutionType: "MAGIC" });
    expect(result.success).toBe(false);
  });

  it("rejects a VERIFIED differentiation claim with no cited sources", () => {
    const result = solutionSchema.safeParse({
      ...validSolution,
      differentiation: { ...validSolution.differentiation, overallClaim: richClaim("VERIFIED", []) },
    });
    expect(result.success).toBe(false);
  });

  it("allows null hardwareRole when hardware isn't involved", () => {
    const result = solutionSchema.safeParse(validSolution);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hardwareRole).toBeNull();
  });
});

describe("dataFlowSchema", () => {
  it("requires all seven canonical stages", () => {
    const full = {
      input: dataFlowStage(),
      ingestion: dataFlowStage(),
      validation: dataFlowStage(),
      processing: dataFlowStage(),
      intelligence: dataFlowStage(),
      decision: dataFlowStage(),
      output: dataFlowStage(),
    };
    expect(dataFlowSchema.safeParse(full).success).toBe(true);
  });

  it("rejects a missing stage", () => {
    const partial = { input: dataFlowStage(), ingestion: dataFlowStage() };
    expect(dataFlowSchema.safeParse(partial).success).toBe(false);
  });
});

describe("userJourneyStageSchema", () => {
  it("accepts a subset of canonical stages — not every project touches all eight", () => {
    expect(userJourneyStageSchema.safeParse({ stage: "DISCOVERY", description: "d" }).success).toBe(
      true,
    );
  });

  it("rejects an invented stage", () => {
    expect(userJourneyStageSchema.safeParse({ stage: "TELEPORT", description: "d" }).success).toBe(
      false,
    );
  });
});

describe("featureScopeSchema", () => {
  it("allows all four buckets to be empty", () => {
    const result = featureScopeSchema.safeParse({
      mustHave: [],
      shouldHave: [],
      future: [],
      doNotBuild: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("implementationStepSchema", () => {
  it("requires the effort estimate to be a marketNumber, not a bare figure", () => {
    const result = implementationStepSchema.safeParse({
      stepNumber: 0,
      objective: "o",
      deliverable: "d",
      dependency: "n/a",
      estimatedEffort: unknownNumber(),
      risk: "n/a",
      completionCondition: "c",
    });
    expect(result.success).toBe(true);
  });
});

describe("solutionRiskSchema", () => {
  it("allows a null sourceRiskId for a solution-specific (not Phase 07-derived) risk", () => {
    const result = solutionRiskSchema.safeParse({
      riskId: "risk-1",
      sourceRiskId: null,
      title: "t",
      category: "TECHNICAL",
      impact: "medium",
      mitigation: "m",
      fallback: "f",
      residualRisk: "low",
      basis: "ai_estimate",
      confidence: "medium",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented risk category", () => {
    const result = solutionRiskSchema.safeParse({
      riskId: "risk-1",
      sourceRiskId: null,
      title: "t",
      category: "ALIEN",
      impact: "medium",
      mitigation: "m",
      fallback: "f",
      residualRisk: "low",
      basis: "ai_estimate",
      confidence: "medium",
    });
    expect(result.success).toBe(false);
  });
});

describe("pocDefinitionSchema", () => {
  it("requires at least one success and one failure criterion", () => {
    const result = pocDefinitionSchema.safeParse({
      objective: "o",
      scope: "s",
      input: "i",
      process: "p",
      output: "out",
      successCriteria: [],
      failureCriteria: ["it doesn't work"],
    });
    expect(result.success).toBe(false);
  });
});

describe("successMetricSchema", () => {
  it("accepts a TARGET status", () => {
    const result = successMetricSchema.safeParse({
      metric: "accuracy",
      targetValue: 90,
      unit: "%",
      status: "TARGET",
      reasoning: "r",
    });
    expect(result.success).toBe(true);
  });

  it("rejects VERIFIED as a status — nothing has been measured yet", () => {
    const result = successMetricSchema.safeParse({
      metric: "accuracy",
      targetValue: 90,
      unit: "%",
      status: "VERIFIED",
      reasoning: "r",
    });
    expect(result.success).toBe(false);
  });
});

describe("modeSolutionPlanSchema", () => {
  it("accepts exactly one populated mode block", () => {
    const result = modeSolutionPlanSchema.safeParse({
      mode: "HACKATHON",
      hackathon: {
        buildPlan24Hour: ["step 1"],
        demoFlow: ["show the app"],
        mustBuild: [],
        shouldBuild: [],
        doNotBuild: [],
        demoNarrative: "n",
        judgeFacingValueProposition: "v",
      },
      pbl: null,
      startup: null,
      research: null,
      zeroDegree: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("solutionConsultantOutputSchema", () => {
  const validModeSolutionPlan = {
    mode: "HACKATHON",
    hackathon: {
      buildPlan24Hour: ["step 1"],
      demoFlow: ["show the app"],
      mustBuild: [],
      shouldBuild: [],
      doNotBuild: [],
      demoNarrative: "n",
      judgeFacingValueProposition: "v",
    },
    pbl: null,
    startup: null,
    research: null,
    zeroDegree: null,
  };

  it("accepts a full, well-formed output", () => {
    const result = solutionConsultantOutputSchema.safeParse({
      solution: validSolution,
      whyThisSolution: {
        painAddressed: "p",
        gapAddressed: "g",
        opportunityAddressed: "o",
        existingSolutionLimitations: "l",
        feasibilityRationale: "f",
        marketRationale: "m",
        summary: "s",
      },
      alternativesConsidered: [],
      featureScope: { mustHave: [], shouldHave: [], future: [], doNotBuild: [] },
      dataFlow: {
        input: dataFlowStage(),
        ingestion: dataFlowStage(),
        validation: dataFlowStage(),
        processing: dataFlowStage(),
        intelligence: dataFlowStage(),
        decision: dataFlowStage(),
        output: dataFlowStage(),
      },
      engineeringSafety: null,
      aiArchitecture: null,
      humanInTheLoop: [],
      technologyStack: [],
      pocDefinition: {
        objective: "o",
        scope: "s",
        input: "i",
        process: "p",
        output: "out",
        successCriteria: ["works"],
        failureCriteria: ["doesn't work"],
      },
      successMetrics: [],
      modeSolutionPlan: validModeSolutionPlan,
      solutionRealityCheck: { status: "RECOMMENDED_WITH_CONSTRAINTS", explanation: "e" },
      evidenceSummary: { narrative: "n/a" },
      confidenceSummary: { overallConfidence: "MODERATE", narrative: "n/a" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(true);
  });

  it("allows a null solution — 'do not manufacture a solution' when there is nothing to build on", () => {
    const result = solutionConsultantOutputSchema.safeParse({
      solution: null,
      whyThisSolution: null,
      alternativesConsidered: [],
      featureScope: null,
      dataFlow: null,
      engineeringSafety: null,
      aiArchitecture: null,
      humanInTheLoop: [],
      technologyStack: [],
      pocDefinition: null,
      successMetrics: [],
      modeSolutionPlan: validModeSolutionPlan,
      solutionRealityCheck: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
      evidenceSummary: { narrative: "n/a" },
      confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented solution reality status", () => {
    const result = solutionConsultantOutputSchema.safeParse({
      solution: null,
      whyThisSolution: null,
      alternativesConsidered: [],
      featureScope: null,
      dataFlow: null,
      engineeringSafety: null,
      aiArchitecture: null,
      humanInTheLoop: [],
      technologyStack: [],
      pocDefinition: null,
      successMetrics: [],
      modeSolutionPlan: validModeSolutionPlan,
      solutionRealityCheck: { status: "MAYBE_BUILD_IT", explanation: "e" },
      evidenceSummary: { narrative: "n/a" },
      confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
      consultantMessage: "m",
    });
    expect(result.success).toBe(false);
  });
});
