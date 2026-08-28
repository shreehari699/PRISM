import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runOpportunityInnovationPhase } from "./index";

function providerWithSequence(results: unknown[]): AiProvider {
  const generateStructured = vi.fn();
  for (const r of results) {
    generateStructured.mockResolvedValueOnce(r);
  }
  return { name: "fake", model: "fake-model", generateStructured };
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
  solutions: [],
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
    solutionsIdentified: 0,
    queriesExecuted: 1,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

function gapCandidate(overrides: Record<string, unknown> = {}) {
  return {
    gapId: "gap-1",
    title: "No automated prioritization",
    description: "d",
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedExistingSolutions: [],
    missingCapability: { claim: "x", status: "INFERENCE", sourceIds: [], confidence: "medium", reasoning: "y" },
    whyItMatters: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
    evidenceClaims: [],
    sourceIds: [],
    gapType: "FUNCTIONAL",
    confidence: "MEDIUM",
    gapState: "CANDIDATE_GAP",
    validationStatus: "NEEDS_VALIDATION",
    ...overrides,
  };
}

function validGapIntelligence(overrides: Record<string, unknown> = {}): GapIntelligenceAnalysis {
  return {
    problemSummary: "s",
    stakeholderSummary: "s",
    solutionLandscapeSummary: "s",
    gapCandidates: [gapCandidate()],
    confirmedGaps: [],
    candidateGaps: ["gap-1"],
    unverifiedGaps: [],
    noGapFindings: [],
    coverageMatrix: [],
    gapPriority: [],
    gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
    validationQuestions: [],
    evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
    consultantMessage: "n/a",
    ...overrides,
  } as GapIntelligenceAnalysis;
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    phaseKey: "opportunity_innovation" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: validProblemAnatomy,
      stakeholder_pain: validStakeholderPain,
      existing_solutions: validExistingSolutions,
      gap_intelligence: validGapIntelligence(),
      ...overrides,
    },
    userId: "user-1",
  };
}

function claim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

function score() {
  return { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" };
}

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    title: "District-level price transparency service",
    description: "d",
    unservedNeed: claim("INFERENCE"),
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedGaps: ["gap-1"],
    existingSolutionContext: claim("ASSUMPTION"),
    whyNow: { factors: [], summary: "s" },
    impact: [],
    valuePotential: score(),
    impactPotential: score(),
    evidenceClaims: [],
    confidence: "medium",
    opportunityState: "PROMISING_OPPORTUNITY",
    ...overrides,
  };
}

function validOpportunityOutput(overrides: Record<string, unknown> = {}) {
  return {
    opportunities: [opportunity()],
    ...overrides,
  };
}

function direction(overrides: Record<string, unknown> = {}) {
  return {
    directionType: "SOFTWARE",
    whyItCouldAddressTheGap: "a",
    whatItWouldChange: "b",
    stakeholderBenefit: "c",
    newCapability: "d",
    assumptionsRequired: [],
    aiJustification: { classification: "AI_OPTIONAL", reasoning: "e" },
    ...overrides,
  };
}

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    innovationDirections: [direction()],
    differentiation: claim("ASSUMPTION"),
    innovationPotential: score(),
    feasibilityPotential: score(),
    refinedOpportunityState: "PROMISING_OPPORTUNITY",
    validationQuestions: [],
    ...overrides,
  };
}

function landscapeEntry(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: "opp-1",
    stakeholderValue: "medium",
    painRelevance: "medium",
    gapStrength: "medium",
    differentiationStrength: "low",
    innovationStrength: "medium",
    feasibilityStrength: "high",
    impactStrength: "medium",
    confidence: "medium",
    reasoning: "n/a",
    ...overrides,
  };
}

function validInnovationOutput(overrides: Record<string, unknown> = {}) {
  return {
    assessments: [assessment()],
    opportunityLandscape: [landscapeEntry()],
    opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
    consultantMessage: "m",
    ...overrides,
  };
}

describe("runOpportunityInnovationPhase", () => {
  it("merges both agents' output, refining opportunityState and computing rank", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput(), usage: { totalTokens: 100 } },
      { status: "ok", model: "x", data: validInnovationOutput(), usage: { totalTokens: 200 } },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.opportunities).toHaveLength(1);
      expect(result.data.opportunities[0]!.opportunityState).toBe("PROMISING_OPPORTUNITY");
      expect(result.data.opportunities[0]!.innovationDirections).toHaveLength(1);
      expect(result.data.opportunityLandscape[0]!.rank).toBe(1);
      expect(result.data.overallFinding).toBe("MEANINGFUL_OPPORTUNITY_FOUND");
      expect(result.usage?.totalTokens).toBe(300);
    }
  });

  it("propagates an Opportunity Agent failure without calling the Innovation Agent", async () => {
    const provider = providerWithSequence([{ status: "unavailable", reason: "model retired" }]);

    const result = await runOpportunityInnovationPhase(context(), provider);

    expect(result.status).toBe("unavailable");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("propagates an Innovation Agent failure", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);

    expect(result.status).toBe("invalid_output");
  });

  it("rejects an opportunity referencing an unknown stakeholder", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({
          opportunities: [opportunity({ affectedStakeholders: ["ghost"] })],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown stakeholder/);
    }
  });

  it("rejects an opportunity referencing an unknown pain", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({ opportunities: [opportunity({ relatedPains: ["ghost"] })] }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects an opportunity referencing a gap that doesn't exist", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({ opportunities: [opportunity({ relatedGaps: ["ghost-gap"] })] }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown gap/);
    }
  });

  it("rejects an opportunity grounded in a NO_GAP_ESTABLISHED gap", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({ opportunities: [opportunity()] }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(
      context({ gap_intelligence: validGapIntelligence({ gapCandidates: [gapCandidate({ gapState: "NO_GAP_ESTABLISHED" })] }) }),
      provider,
    );

    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/NO_GAP_ESTABLISHED/);
    }
  });

  it("rejects an opportunity claim citing an unknown source", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({
          opportunities: [opportunity({ unservedNeed: claim("INFERENCE", ["ghost-source"]) })],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  // Literal regression test for the production bug: `Opportunity "OPP-001"
  // has a claim citing unknown source "GAP-001"`. A real, valid gap id
  // (gap-1) is not automatically a valid source id — the two are separate
  // namespaces, and a gap id landing in a sourceIds field must be rejected
  // exactly like any other unknown source, not silently accepted because
  // it happens to be "known" in some other namespace.
  it('rejects a gap id used as a sourceId (the literal "GAP-001 as source" production bug)', async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({
          opportunities: [opportunity({ unservedNeed: claim("INFERENCE", ["gap-1"]) })],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/unknown source "gap-1"/);
    }
  });

  it("accepts a valid sourceId reference (source-1 is a real Phase 03 source)", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({
          opportunities: [opportunity({ unservedNeed: claim("VERIFIED", ["source-1"]) })],
        }),
      },
      { status: "ok", model: "x", data: validInnovationOutput() },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("ok");
  });

  it("accepts a valid gapId reference (gap-1 is a real Phase 04 candidate gap)", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput({ opportunities: [opportunity({ relatedGaps: ["gap-1"] })] }) },
      { status: "ok", model: "x", data: validInnovationOutput() },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("ok");
  });

  it("rejects an innovation assessment referencing an unknown opportunity", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({ assessments: [assessment({ opportunityId: "ghost-opp" })] }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects when an opportunity has no innovation assessment", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      { status: "ok", model: "x", data: validInnovationOutput({ assessments: [] }) },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/no innovation assessment/);
    }
  });

  it("rejects duplicate assessments for the same opportunity", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({ assessments: [assessment(), assessment()] }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/more than one innovation assessment/);
    }
  });

  it("rejects a superlative differentiation claim ('only') without VERIFIED evidence", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [
            assessment({ differentiation: { ...claim("ASSUMPTION"), claim: "The only platform doing this." } }),
          ],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/superlative differentiation/);
    }
  });

  it("accepts a superlative differentiation claim when VERIFIED with a real source", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [
            assessment({
              differentiation: { ...claim("VERIFIED", ["source-1"]), claim: "The only platform doing this." },
            }),
          ],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("ok");
  });

  it("rejects a differentiation claim citing an unknown source", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [assessment({ differentiation: claim("INFERENCE", ["ghost-source"]) })],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
  });

  it("rejects an AI_ML direction whose own justification says AI is not justified", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [
            assessment({
              innovationDirections: [
                direction({
                  directionType: "AI_ML",
                  aiJustification: { classification: "AI_NOT_JUSTIFIED", reasoning: "e" },
                }),
              ],
            }),
          ],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/contradiction/);
    }
  });

  it("rejects an opportunity landscape that hides an opportunity", async () => {
    const provider = providerWithSequence([
      {
        status: "ok",
        model: "x",
        data: validOpportunityOutput({
          opportunities: [opportunity(), opportunity({ opportunityId: "opp-2" })],
        }),
      },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [assessment(), assessment({ opportunityId: "opp-2" })],
          opportunityLandscape: [landscapeEntry()],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("invalid_output");
    if (result.status === "invalid_output") {
      expect(result.message).toMatch(/missing from the opportunity landscape/);
    }
  });

  it("concludes NO_MEANINGFUL_OPPORTUNITY when the Opportunity Agent found nothing", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput({ opportunities: [] }) },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [],
          opportunityLandscape: [],
          opportunityRealityCheck: { signal: "NO_CLEAR_OPPORTUNITY", explanation: "e" },
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.overallFinding).toBe("NO_MEANINGFUL_OPPORTUNITY");
    }
  });

  it("concludes NO_MEANINGFUL_OPPORTUNITY when every opportunity is refined down to INSUFFICIENT_EVIDENCE", async () => {
    const provider = providerWithSequence([
      { status: "ok", model: "x", data: validOpportunityOutput() },
      {
        status: "ok",
        model: "x",
        data: validInnovationOutput({
          assessments: [
            assessment({ innovationDirections: [], refinedOpportunityState: "INSUFFICIENT_EVIDENCE" }),
          ],
        }),
      },
    ]);

    const result = await runOpportunityInnovationPhase(context(), provider);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.overallFinding).toBe("NO_MEANINGFUL_OPPORTUNITY");
    }
  });
});
