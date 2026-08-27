import { describe, expect, it } from "vitest";

import {
  dataFeasibilitySchema,
  feasibilityAgentOutputSchema,
  modeFeasibilitySchema,
  roadmapPhaseSchema,
  riskEntrySchema,
  softwareFeasibilitySchema,
  technicalFeasibilitySchema,
  teamFeasibilitySchema,
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

function technicalDimension() {
  return { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] };
}

function softwareComponent() {
  return { status: "REQUIRES_BUILD", reasoning: "n/a" };
}

function scalabilityAssessment() {
  return { level: "UNKNOWN", reasoning: "n/a" };
}

function score() {
  return { value: 30, basis: "ai_estimate", reasoning: "n/a", confidence: "low" };
}

const validModeFeasibility = {
  mode: "HACKATHON",
  hackathon: {
    timeAvailable: richClaim(),
    teamSize: richClaim(),
    teamSkills: richClaim(),
    hardwareAccess: richClaim(),
    softwareAccess: richClaim(),
    apiAccess: richClaim(),
    dataAccess: richClaim(),
    prototypeScope: "a",
    demoScope: "b",
    deploymentScope: "c",
    durationFeasibility: [{ duration: "24_HOUR", status: "DIFFICULT", reasoning: "y" }],
  },
  pbl: null,
  startup: null,
  research: null,
  zeroDegree: null,
};

function validFullOutput(overrides: Record<string, unknown> = {}) {
  return {
    modeFeasibility: validModeFeasibility,
    technicalFeasibility: {
      architecture: technicalDimension(),
      technologyMaturity: technicalDimension(),
      dependencies: technicalDimension(),
      apis: technicalDimension(),
      hardware: technicalDimension(),
      software: technicalDimension(),
      data: technicalDimension(),
      infrastructure: technicalDimension(),
      integration: technicalDimension(),
      security: technicalDimension(),
      performance: technicalDimension(),
      reliability: technicalDimension(),
      maintenance: technicalDimension(),
    },
    dataFeasibility: { requirements: [], narrative: "n/a" },
    aiFeasibility: null,
    hardwareFeasibility: null,
    softwareFeasibility: {
      frontend: softwareComponent(),
      backend: softwareComponent(),
      database: softwareComponent(),
      api: softwareComponent(),
      authentication: softwareComponent(),
      deployment: softwareComponent(),
      mobileOrWeb: softwareComponent(),
      thirdPartyServices: softwareComponent(),
      openSourceDependencies: softwareComponent(),
    },
    teamFeasibility: { skills: [], narrative: "n/a" },
    timeFeasibility: {
      minimumViableBuildTime: unknownNumber(),
      prototypeTime: unknownNumber(),
      productionTime: unknownNumber(),
      hackathonDurationFeasibility: [],
    },
    costFeasibility: {
      developmentCost: unknownNumber(),
      hardwareCost: unknownNumber(),
      softwareCost: unknownNumber(),
      apiCost: unknownNumber(),
      infrastructureCost: unknownNumber(),
      deploymentCost: unknownNumber(),
      maintenanceCost: unknownNumber(),
    },
    regulatorySafety: { items: [], narrative: "n/a" },
    securityPrivacy: { considerations: [], securityRisk: "UNKNOWN", reasoning: "n/a" },
    scalability: {
      technical: scalabilityAssessment(),
      data: scalabilityAssessment(),
      infrastructure: scalabilityAssessment(),
      operational: scalabilityAssessment(),
      support: scalabilityAssessment(),
      geographic: scalabilityAssessment(),
      regulatory: scalabilityAssessment(),
    },
    riskRegister: [],
    buildScope: { mustBuild: [], shouldBuild: [], couldBuild: [], doNotBuild: [] },
    feasibilityScores: {
      technical: score(),
      data: score(),
      time: score(),
      cost: score(),
      team: score(),
      deployment: score(),
      scalability: score(),
    },
    overallFeasibility: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
    criticalBlockers: [],
    feasibilityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
    implementationRoadmap: [
      { phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] },
    ],
    validationQuestions: [],
    evidenceSummary: { narrative: "n/a" },
    confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("modeFeasibilitySchema", () => {
  it("accepts exactly one populated mode block", () => {
    expect(modeFeasibilitySchema.safeParse(validModeFeasibility).success).toBe(true);
  });

  it("rejects an invented project mode", () => {
    const result = modeFeasibilitySchema.safeParse({ ...validModeFeasibility, mode: "FREESTYLE" });
    expect(result.success).toBe(false);
  });
});

describe("technicalFeasibilitySchema", () => {
  it("requires all thirteen dimensions", () => {
    const full = {
      architecture: technicalDimension(),
      technologyMaturity: technicalDimension(),
      dependencies: technicalDimension(),
      apis: technicalDimension(),
      hardware: technicalDimension(),
      software: technicalDimension(),
      data: technicalDimension(),
      infrastructure: technicalDimension(),
      integration: technicalDimension(),
      security: technicalDimension(),
      performance: technicalDimension(),
      reliability: technicalDimension(),
      maintenance: technicalDimension(),
    };
    expect(technicalFeasibilitySchema.safeParse(full).success).toBe(true);
  });

  it("rejects a missing dimension", () => {
    const partial = {
      architecture: technicalDimension(),
      technologyMaturity: technicalDimension(),
    };
    expect(technicalFeasibilitySchema.safeParse(partial).success).toBe(false);
  });

  it("rejects an invented status", () => {
    const bad = { ...technicalDimension(), status: "MAYBE" };
    const full = {
      architecture: bad,
      technologyMaturity: technicalDimension(),
      dependencies: technicalDimension(),
      apis: technicalDimension(),
      hardware: technicalDimension(),
      software: technicalDimension(),
      data: technicalDimension(),
      infrastructure: technicalDimension(),
      integration: technicalDimension(),
      security: technicalDimension(),
      performance: technicalDimension(),
      reliability: technicalDimension(),
      maintenance: technicalDimension(),
    };
    expect(technicalFeasibilitySchema.safeParse(full).success).toBe(false);
  });
});

describe("dataFeasibilitySchema", () => {
  it("allows an empty requirements list — no notable data dependency is valid", () => {
    expect(dataFeasibilitySchema.safeParse({ requirements: [], narrative: "n/a" }).success).toBe(
      true,
    );
  });

  it("rejects an invented availability classification", () => {
    const result = dataFeasibilitySchema.safeParse({
      requirements: [
        {
          requiredData: "d",
          dataSource: "s",
          availability: "MAYBE_AVAILABLE",
          quality: richClaim(),
          accessibility: richClaim(),
          privacy: richClaim(),
          licensing: richClaim(),
          updateFrequency: "daily",
        },
      ],
      narrative: "n/a",
    });
    expect(result.success).toBe(false);
  });
});

describe("softwareFeasibilitySchema", () => {
  it("requires all nine components", () => {
    const partial = { frontend: softwareComponent() };
    expect(softwareFeasibilitySchema.safeParse(partial).success).toBe(false);
  });
});

describe("teamFeasibilitySchema", () => {
  it("allows UNKNOWN team capability rather than an invented skill assessment", () => {
    const result = teamFeasibilitySchema.safeParse({
      skills: [
        {
          skillArea: "AI_ML",
          required: true,
          teamHasCapability: "UNKNOWN",
          reasoning: "No team roster was provided.",
        },
      ],
      narrative: "n/a",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented skill area", () => {
    const result = teamFeasibilitySchema.safeParse({
      skills: [
        { skillArea: "MAGIC", required: true, teamHasCapability: "UNKNOWN", reasoning: "y" },
      ],
      narrative: "n/a",
    });
    expect(result.success).toBe(false);
  });
});

describe("riskEntrySchema", () => {
  it("accepts a well-formed, model-derived risk", () => {
    const result = riskEntrySchema.safeParse({
      riskId: "risk-1",
      title: "Dataset may not be obtainable",
      category: "DATA",
      description: "d",
      likelihood: "medium",
      impact: "high",
      severity: "high",
      mitigation: "m",
      residualRisk: "medium",
      basis: "ai_estimate",
      confidence: "low",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented category", () => {
    const result = riskEntrySchema.safeParse({
      riskId: "risk-1",
      title: "t",
      category: "ALIEN_INVASION",
      description: "d",
      likelihood: "medium",
      impact: "high",
      severity: "high",
      mitigation: "m",
      residualRisk: "medium",
      basis: "ai_estimate",
      confidence: "low",
    });
    expect(result.success).toBe(false);
  });
});

describe("roadmapPhaseSchema", () => {
  it("accepts phase 0 as a valid starting point", () => {
    expect(
      roadmapPhaseSchema.safeParse({
        phaseNumber: 0,
        title: "Preparation",
        description: "d",
        deliverables: [],
      }).success,
    ).toBe(true);
  });
});

describe("feasibilityAgentOutputSchema", () => {
  it("accepts a fully honest, evidence-thin output — INSUFFICIENT_EVIDENCE is valid", () => {
    const result = feasibilityAgentOutputSchema.safeParse(validFullOutput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty implementation roadmap", () => {
    const result = feasibilityAgentOutputSchema.safeParse(
      validFullOutput({ implementationRoadmap: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("allows null aiFeasibility and null hardwareFeasibility when neither applies", () => {
    const result = feasibilityAgentOutputSchema.safeParse(validFullOutput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aiFeasibility).toBeNull();
      expect(result.data.hardwareFeasibility).toBeNull();
    }
  });

  it("rejects an invented overall feasibility status", () => {
    const result = feasibilityAgentOutputSchema.safeParse(
      validFullOutput({ overallFeasibility: { status: "PROBABLY_FINE", explanation: "e" } }),
    );
    expect(result.success).toBe(false);
  });

  it("allows an empty criticalBlockers list", () => {
    const result = feasibilityAgentOutputSchema.safeParse(
      validFullOutput({ criticalBlockers: [] }),
    );
    expect(result.success).toBe(true);
  });
});
