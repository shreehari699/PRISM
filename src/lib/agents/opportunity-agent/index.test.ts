import { describe, expect, it, vi } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { AiProvider } from "@/lib/ai/types";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { runOpportunityAgent } from "./index";

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
      sourceLocalId: "source-1",
      query: "existing solutions",
      category: "COMMERCIAL",
      title: "eNAM",
      url: "https://enam.gov.in",
      sourceType: "government",
      retrievedAt: "2025-01-01T00:00:00.000Z",
      snippet: "A national e-market platform for agricultural commodities.",
    },
  ],
  solutions: [],
  researchCoverage: {
    commercial: "INSUFFICIENT",
    government: "INSUFFICIENT",
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

const validGapIntelligence: GapIntelligenceAnalysis = {
  problemSummary: "s",
  stakeholderSummary: "s",
  solutionLandscapeSummary: "s",
  gapCandidates: [
    {
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
    },
  ],
  confirmedGaps: [],
  candidateGaps: ["gap-1"],
  unverifiedGaps: [],
  noGapFindings: [],
  coverageMatrix: [],
  gapPriority: [],
  gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
  validationQuestions: [],
  evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n" },
  confidenceSummary: { overallConfidence: "LOW", narrative: "n" },
  consultantMessage: "m",
};

const validOutput = {
  opportunities: [],
};

function context(upstream: {
  problemIntelligence?: unknown;
  stakeholderPain?: unknown;
  existingSolutions?: unknown;
  gapIntelligence?: unknown;
}) {
  return {
    phaseKey: "opportunity_innovation" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {
      problem_intelligence: upstream.problemIntelligence,
      stakeholder_pain: upstream.stakeholderPain,
      existing_solutions: upstream.existingSolutions,
      gap_intelligence: upstream.gapIntelligence,
    },
    userId: "user-1",
  };
}

const fullValidUpstream = {
  problemIntelligence: validProblemAnatomy,
  stakeholderPain: validStakeholderPain,
  existingSolutions: validExistingSolutions,
  gapIntelligence: validGapIntelligence,
};

describe("runOpportunityAgent", () => {
  it("returns an error without calling the provider when Phase 01 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runOpportunityAgent(
      context({
        stakeholderPain: validStakeholderPain,
        existingSolutions: validExistingSolutions,
        gapIntelligence: validGapIntelligence,
      }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 02 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runOpportunityAgent(
      context({
        problemIntelligence: validProblemAnatomy,
        existingSolutions: validExistingSolutions,
        gapIntelligence: validGapIntelligence,
      }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 03 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runOpportunityAgent(
      context({
        problemIntelligence: validProblemAnatomy,
        stakeholderPain: validStakeholderPain,
        gapIntelligence: validGapIntelligence,
      }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns an error without calling the provider when Phase 04 output is missing", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runOpportunityAgent(
      context({
        problemIntelligence: validProblemAnatomy,
        stakeholderPain: validStakeholderPain,
        existingSolutions: validExistingSolutions,
      }),
      provider,
    );

    expect(result.status).toBe("error");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("calls the provider with a schema that accepts a valid opportunity output when all four upstream phases are valid", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runOpportunityAgent(context(fullValidUpstream), provider);

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.schema.safeParse(validOutput).success).toBe(true);
  });

  function opportunityWithSourceIds(sourceIds: string[]) {
    return {
      opportunityId: "opp-1",
      title: "t",
      description: "d",
      unservedNeed: { claim: "x", status: "INFERENCE", sourceIds, confidence: "medium", reasoning: "y" },
      affectedStakeholders: ["farmer"],
      relatedPains: ["pain-1"],
      relatedGaps: ["gap-1"],
      existingSolutionContext: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "medium", reasoning: "y" },
      whyNow: { factors: [], summary: "s" },
      impact: [],
      valuePotential: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      impactPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      evidenceClaims: [],
      confidence: "medium",
      opportunityState: "PROMISING_OPPORTUNITY",
    };
  }

  // The literal production bug, reproduced at the schema-construction
  // level: the schema built for this call must itself reject a gap id
  // placed in a sourceIds field — not merely rely on the composer to
  // catch it after the fact. This is what makes it something Gemini's
  // own structured output is constrained against emitting, not just
  // something the composer cleans up afterward.
  it("builds a schema that rejects a gap id used as a sourceId, the literal GAP-001/GAP-01 production bug", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runOpportunityAgent(context(fullValidUpstream), provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    const withGapAsSource = { opportunities: [opportunityWithSourceIds(["gap-1"])] };
    const withRealSource = { opportunities: [opportunityWithSourceIds(["source-1"])] };

    expect(call.schema.safeParse(withGapAsSource).success).toBe(false);
    expect(call.schema.safeParse(withRealSource).success).toBe(true);
  });

  it("builds a schema that rejects an unknown/nonexistent sourceId the same way", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runOpportunityAgent(context(fullValidUpstream), provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.schema.safeParse({ opportunities: [opportunityWithSourceIds(["ghost-source"])] }).success).toBe(
      false,
    );
  });

  it("builds a schema that forces sourceIds empty when Phase 03 found no sources at all", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runOpportunityAgent(
      context({ ...fullValidUpstream, existingSolutions: { ...validExistingSolutions, sources: [] } }),
      provider,
    );

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.schema.safeParse({ opportunities: [opportunityWithSourceIds(["source-1"])] }).success).toBe(
      false,
    );
    expect(call.schema.safeParse({ opportunities: [opportunityWithSourceIds([])] }).success).toBe(true);
  });
});
