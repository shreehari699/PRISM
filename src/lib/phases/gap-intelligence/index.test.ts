import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runGapIntelligencePhase } from "./index";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

const validProblemAnatomy: ProblemAnatomy = {
  restatement: "Smallholder farmers lack real-time crop pricing.",
  who: [{ group: "Farmers", description: "Affected group" }],
  what: { claim: "x", status: "INFERENCE", reasoning: "y" },
  where: { claim: "x", status: "INFERENCE", reasoning: "y" },
  when: { claim: "x", status: "INFERENCE", reasoning: "y" },
  why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
  assumptions: [],
  openQuestions: [],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
};

const validStakeholderPain: StakeholderPainAnalysis = {
  stakeholders: [
    {
      localId: "farmer",
      name: "Smallholder farmer",
      category: "PRIMARY",
      roles: ["USER"],
      relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
      context: "ctx",
      needs: [],
      decisionPower: "none",
      influence: "low",
      urgency: "high",
      impact: "high",
      evidenceClaims: [],
      confidence: "medium",
      painPointIds: ["pain-1"],
    },
  ],
  painPoints: [
    {
      localId: "pain-1",
      stakeholderLocalId: "farmer",
      painTitle: "No price visibility",
      description: "d",
      cause: { claim: "x", status: "INFERENCE", reasoning: "y" },
      frequency: { claim: "x", status: "UNKNOWN", reasoning: "y" },
      riskIfUnsolved: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
      severityScore: {
        dimensions: {
          severity: 70,
          frequency: 50,
          reach: 40,
          consequence: 60,
          urgency: 55,
          currentSolutionSatisfaction: 20,
        },
        overall: { value: 58, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      },
      confidence: "medium",
      evidenceClaims: [],
    },
  ],
  primaryPain: { painLocalId: "pain-1", reasoning: "Root cause, not a symptom." },
  secondaryPains: [],
  downstreamConsequences: [],
  customerDistinction: { applicable: false, notes: [] },
  validationQuestions: ["How frequently does this occur?"],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "n/a",
};

const validExistingSolutions: ExistingSolutionsAnalysis = {
  queries: [],
  sources: [
    {
      title: "eNAM",
      url: "https://enam.gov.in",
      sourceType: "government",
      retrievedAt: new Date().toISOString(),
      snippet: "A national electronic trading platform.",
      sourceLocalId: "source-1",
      query: "government crop pricing platform",
      category: "GOVERNMENT",
    },
  ],
  solutions: [
    {
      localId: "sol-1",
      name: "eNAM",
      organization: "Government of India",
      country: "India",
      yearIfVerified: "2016",
      solutionType: "GOVERNMENT_PROGRAM",
      targetUsers: [],
      targetStakeholders: [],
      problemAddressed: { claim: "x", status: "VERIFIED", reasoning: "y" },
      painAddressed: [],
      howItWorks: { claim: "x", status: "INFERENCE", reasoning: "y" },
      technology: [],
      deploymentStatus: "ACTIVE",
      businessModelIfKnown: "UNKNOWN",
      strengths: [],
      limitations: [],
      evidenceClaims: [],
      sourceIds: ["source-1"],
      confidence: "medium",
      stakeholderCoverage: ["farmer"],
      painCoverage: ["pain-1"],
      costInformation: "UNKNOWN",
      geographicCoverage: "India",
      evidenceConfidence: "medium",
    },
  ],
  researchCoverage: {
    commercial: "INSUFFICIENT",
    government: "LOW",
    academic: "INSUFFICIENT",
    startup: "INSUFFICIENT",
    openSource: "INSUFFICIENT",
    international: "INSUFFICIENT",
    technology: "INSUFFICIENT",
  },
  stats: {
    sourcesFound: 1,
    sourcesUsed: 1,
    solutionsIdentified: 1,
    queriesExecuted: 1,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

function context() {
  return {
    phaseKey: "gap_intelligence" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy,
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
    },
    userId: "user-1",
  };
}

function claim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = ["source-1"],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function gapCandidate(overrides: Record<string, unknown> = {}) {
  return {
    gapId: "gap-1",
    title: "No automated prioritization",
    description: "d",
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedExistingSolutions: ["sol-1"],
    missingCapability: claim("INFERENCE"),
    whyItMatters: claim("ASSUMPTION", []),
    evidenceClaims: [],
    sourceIds: ["source-1"],
    gapType: "FUNCTIONAL",
    confidence: "MEDIUM",
    gapState: "CANDIDATE_GAP",
    validationStatus: "NEEDS_VALIDATION",
    ...overrides,
  };
}

function validGapOutput(overrides: Record<string, unknown> = {}) {
  return {
    problemSummary: "s",
    stakeholderSummary: "s",
    solutionLandscapeSummary: "s",
    gapCandidates: [gapCandidate()],
    coverageMatrix: [],
    gapPriority: [],
    gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
    validationQuestions: ["Does the platform support offline use?"],
    evidenceSummary: { narrative: "n" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runGapIntelligencePhase", () => {
  it("merges the gap agent's output, bucketing gapIds by state and computing evidence counts", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validGapOutput() });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.candidateGaps).toEqual(["gap-1"]);
      expect(result.data.confirmedGaps).toEqual([]);
      expect(result.data.evidenceSummary.totalSourcesReferenced).toBe(1);
      expect(result.data.evidenceSummary.verifiedClaimsCount).toBe(0);
    }
  });

  it("propagates a Gap Agent failure", async () => {
    const provider = fakeProvider({ status: "unavailable", reason: "model retired" });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("unavailable");
  });

  it("buckets a NO_GAP_ESTABLISHED candidate correctly and allows a fully empty gap list", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [gapCandidate({ gapState: "NO_GAP_ESTABLISHED", sourceIds: [] })],
        gapRealityCheck: { signal: "NO_CLEAR_GAP", explanation: "Existing platform already covers this." },
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.noGapFindings).toEqual(["gap-1"]);
      expect(result.data.candidateGaps).toEqual([]);
    }
  });

  it("rejects a gap referencing a stakeholder that doesn't exist", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [gapCandidate({ affectedStakeholders: ["ghost-stakeholder"] })],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown stakeholder/);
    }
  });

  it("rejects a gap referencing a pain that doesn't exist", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({ gapCandidates: [gapCandidate({ relatedPains: ["ghost-pain"] })] }),
    });

    const result = await runGapIntelligencePhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects a gap referencing an existing solution that doesn't exist", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [gapCandidate({ relatedExistingSolutions: ["ghost-sol"] })],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects a gap citing a source that doesn't exist", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({ gapCandidates: [gapCandidate({ sourceIds: ["ghost-source"] })] }),
    });

    const result = await runGapIntelligencePhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects a CONFIRMED_GAP whose core claim is only an ASSUMPTION", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [
          gapCandidate({
            gapState: "CONFIRMED_GAP",
            missingCapability: claim("ASSUMPTION", ["source-1"]),
          }),
        ],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/only an ASSUMPTION/);
    }
  });

  it("rejects a CONFIRMED_GAP that cites zero sources", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [
          gapCandidate({
            gapState: "CONFIRMED_GAP",
            missingCapability: claim("INFERENCE", ["source-1"]),
            sourceIds: [],
          }),
        ],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/cites no sources/);
    }
  });

  it("accepts a well-evidenced CONFIRMED_GAP", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapCandidates: [
          gapCandidate({
            gapState: "CONFIRMED_GAP",
            missingCapability: claim("VERIFIED", ["source-1"]),
            sourceIds: ["source-1"],
          }),
        ],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.confirmedGaps).toEqual(["gap-1"]);
      expect(result.data.evidenceSummary.verifiedClaimsCount).toBe(1);
    }
  });

  it("rejects a coverage matrix entry referencing an unknown solution/stakeholder/pain", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        coverageMatrix: [
          {
            existingSolutionId: "ghost-sol",
            stakeholderId: "farmer",
            painId: "pain-1",
            capability: "predictive pricing",
            status: "UNKNOWN",
            reasoning: "n/a",
            sourceIds: [],
          },
        ],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects a gap priority entry referencing an unknown gap id", async () => {
    const provider = fakeProvider({
      status: "ok",
      model: "x",
      data: validGapOutput({
        gapPriority: [
          {
            gapId: "ghost-gap",
            overallPriority: {
              value: 50,
              basis: "ai_estimate",
              reasoning: "n/a",
              confidence: "low",
            },
            dimensions: {},
          },
        ],
      }),
    });

    const result = await runGapIntelligencePhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });
});
