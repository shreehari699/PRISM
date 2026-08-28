import { describe, expect, it } from "vitest";

import { describePhaseFindings } from "./phase-findings";

describe("describePhaseFindings", () => {
  it("returns null instead of fabricating a finding when the output doesn't parse", () => {
    expect(describePhaseFindings("problem_intelligence", { garbage: true })).toBeNull();
    expect(describePhaseFindings("stakeholder_pain", null)).toBeNull();
  });

  it("pulls a real count out of Problem Intelligence's own output", () => {
    const anatomy = {
      restatement: "r",
      who: [{ group: "Farmers", description: "d" }],
      what: { claim: "x", status: "INFERENCE", reasoning: "y" },
      where: { claim: "x", status: "INFERENCE", reasoning: "y" },
      when: { claim: "x", status: "INFERENCE", reasoning: "y" },
      why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
      assumptions: [],
      openQuestions: ["Q1", "Q2"],
      clarity: { isWellDefined: true, issues: [] },
      problemScore: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    };
    const line = describePhaseFindings("problem_intelligence", anatomy);
    expect(line).toContain("1 affected group");
    expect(line).toContain("2 open questions");
  });

  it("pulls a real pain-point count out of Stakeholder & Pain's own output", () => {
    const analysis = {
      stakeholders: [
        {
          localId: "farmer",
          name: "Farmer",
          category: "PRIMARY",
          roles: ["USER"],
          relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
          context: "c",
          needs: [],
          decisionPower: "none",
          influence: "low",
          urgency: "high",
          impact: "high",
          evidenceClaims: [],
          confidence: "medium",
          painPointIds: ["pain-1", "pain-2", "pain-3"],
        },
      ],
      painPoints: [1, 2, 3].map((n) => ({
        localId: `pain-${n}`,
        stakeholderLocalId: "farmer",
        painTitle: "t",
        description: "d",
        cause: { claim: "x", status: "INFERENCE", reasoning: "y" },
        frequency: { claim: "x", status: "UNKNOWN", reasoning: "y" },
        riskIfUnsolved: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
        severityScore: {
          dimensions: { severity: 1, frequency: 1, reach: 1, consequence: 1, urgency: 1, currentSolutionSatisfaction: 1 },
          overall: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
        },
        confidence: "medium",
        evidenceClaims: [],
      })),
      primaryPain: { painLocalId: "pain-1", reasoning: "r" },
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
    const line = describePhaseFindings("stakeholder_pain", analysis);
    expect(line).toContain("3 key pain points");
  });

  it("returns a distinct, real line per phase key for a phase with no meaningful result", () => {
    // Each phase key must be handled — this guards against a future
    // silently-missing case in the switch falling through to `null`
    // (a generic line) for every phase instead of a real one.
    const zeroGapIntelligence = {
      problemSummary: "s",
      stakeholderSummary: "s",
      solutionLandscapeSummary: "s",
      gapCandidates: [],
      confirmedGaps: [],
      candidateGaps: [],
      unverifiedGaps: [],
      noGapFindings: [],
      coverageMatrix: [],
      gapPriority: [],
      gapRealityCheck: { signal: "NO_CLEAR_GAP", explanation: "e" },
      validationQuestions: [],
      evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n" },
      confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
      consultantMessage: "n/a",
    };
    const line = describePhaseFindings("gap_intelligence", zeroGapIntelligence);
    expect(line).toContain("0 confirmed gaps");
    expect(line).toMatch(/no clear gap/i);
  });
});
