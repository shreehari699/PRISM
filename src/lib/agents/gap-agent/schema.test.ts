import { describe, expect, it } from "vitest";

import {
  gapAgentOutputSchema,
  gapCandidateSchema,
  gapEvidenceClaimSchema,
  gapPriorityEntrySchema,
} from "./schema";

function claim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = ["source-1"],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

describe("gapEvidenceClaimSchema", () => {
  it("accepts a well-formed claim", () => {
    expect(gapEvidenceClaimSchema.safeParse(claim()).success).toBe(true);
  });

  it("rejects a VERIFIED claim with no source ids", () => {
    const result = gapEvidenceClaimSchema.safeParse(claim("VERIFIED", []));
    expect(result.success).toBe(false);
  });

  it("accepts a VERIFIED claim that does cite a source", () => {
    const result = gapEvidenceClaimSchema.safeParse(claim("VERIFIED", ["source-1"]));
    expect(result.success).toBe(true);
  });

  it("allows ASSUMPTION and UNKNOWN with no sources", () => {
    expect(gapEvidenceClaimSchema.safeParse(claim("ASSUMPTION", [])).success).toBe(true);
    expect(gapEvidenceClaimSchema.safeParse(claim("UNKNOWN", [])).success).toBe(true);
  });

  it("rejects an invented evidence status", () => {
    const result = gapEvidenceClaimSchema.safeParse({ ...claim(), status: "PROVEN" });
    expect(result.success).toBe(false);
  });
});

const validGapCandidate = {
  gapId: "gap-1",
  title: "No automated prioritization",
  description: "Existing platforms log inspections but don't prioritize follow-up.",
  affectedStakeholders: ["operator"],
  relatedPains: ["pain-1"],
  relatedExistingSolutions: ["sol-1"],
  missingCapability: claim("INFERENCE"),
  whyItMatters: claim("ASSUMPTION", []),
  sourceIds: ["source-1"],
  gapType: "FUNCTIONAL",
  confidence: "MEDIUM",
  gapState: "CANDIDATE_GAP",
  validationStatus: "NEEDS_VALIDATION",
};

describe("gapCandidateSchema", () => {
  it("accepts a well-formed candidate", () => {
    expect(gapCandidateSchema.safeParse(validGapCandidate).success).toBe(true);
  });

  it("rejects an invented gapType", () => {
    const result = gapCandidateSchema.safeParse({ ...validGapCandidate, gapType: "MAGIC" });
    expect(result.success).toBe(false);
  });

  it("rejects an invented gapState", () => {
    const result = gapCandidateSchema.safeParse({
      ...validGapCandidate,
      gapState: "PROBABLE_GAP",
    });
    expect(result.success).toBe(false);
  });

  it("accepts NO_GAP_ESTABLISHED as a distinct classification", () => {
    const result = gapCandidateSchema.safeParse({
      ...validGapCandidate,
      gapState: "NO_GAP_ESTABLISHED",
    });
    expect(result.success).toBe(true);
  });

  it("defaults affectedStakeholders/relatedPains/relatedExistingSolutions to empty arrays", () => {
    const { affectedStakeholders, relatedPains, relatedExistingSolutions, ...rest } =
      validGapCandidate;
    void affectedStakeholders;
    void relatedPains;
    void relatedExistingSolutions;
    const result = gapCandidateSchema.parse(rest);
    expect(result.affectedStakeholders).toEqual([]);
    expect(result.relatedPains).toEqual([]);
    expect(result.relatedExistingSolutions).toEqual([]);
  });
});

describe("gapPriorityEntrySchema", () => {
  it("requires overallPriority to carry reasoning and basis, not a bare number", () => {
    const result = gapPriorityEntrySchema.safeParse({
      gapId: "gap-1",
      overallPriority: { value: 70 },
      dimensions: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed priority entry with partial dimensions", () => {
    const result = gapPriorityEntrySchema.safeParse({
      gapId: "gap-1",
      overallPriority: {
        value: 70,
        basis: "ai_estimate",
        reasoning: "High pain severity and no coverage found.",
        confidence: "medium",
      },
      dimensions: {
        painSeverity: {
          value: 80,
          basis: "ai_estimate",
          reasoning: "n/a",
          confidence: "medium",
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("gapAgentOutputSchema", () => {
  const validOutput = {
    problemSummary: "s",
    stakeholderSummary: "s",
    solutionLandscapeSummary: "s",
    gapCandidates: [validGapCandidate],
    coverageMatrix: [],
    gapPriority: [],
    gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
    validationQuestions: ["Does the platform support offline use?"],
    evidenceSummary: { narrative: "n" },
    confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
    consultantMessage: "m",
  };

  it("accepts a well-formed output", () => {
    expect(gapAgentOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("allows an empty gapCandidates list — 'no meaningful gap' is a valid result", () => {
    const result = gapAgentOutputSchema.safeParse({ ...validOutput, gapCandidates: [] });
    expect(result.success).toBe(true);
  });

  it("requires a gapRealityCheck with an explanation", () => {
    const result = gapAgentOutputSchema.safeParse({
      ...validOutput,
      gapRealityCheck: { signal: "NO_CLEAR_GAP", explanation: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invented reality-check signal", () => {
    const result = gapAgentOutputSchema.safeParse({
      ...validOutput,
      gapRealityCheck: { signal: "DEFINITELY_A_GAP", explanation: "e" },
    });
    expect(result.success).toBe(false);
  });
});
