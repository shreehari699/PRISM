import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

const problemAnatomy: ProblemAnatomy = {
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

const stakeholderPain: StakeholderPainAnalysis = {
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
  validationQuestions: [],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "n/a",
};

const existingSolutions: ExistingSolutionsAnalysis = {
  queries: [],
  sources: [],
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
    sourcesFound: 0,
    sourcesUsed: 0,
    solutionsIdentified: 0,
    queriesExecuted: 0,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: "n/a",
};

const gapIntelligence: GapIntelligenceAnalysis = {
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
  confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
  consultantMessage: "n/a",
};

describe("buildSystemInstruction (Opportunity Agent)", () => {
  it("forbids treating every gap as an opportunity", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/NOT 'generate 10 startup ideas'/);
    expect(instruction).toMatch(/NOT 'invent a futuristic solution'/);
  });

  it("says an empty opportunity list is a valid, honest result", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/no meaningful opportunity at all/i);
  });

  it("forbids fabricating why-now trends", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/do not fabricate a trend/i);
  });

  it("forbids treating NO_GAP_ESTABLISHED as an opportunity source", () => {
    const instruction = buildSystemInstruction("PBL", ["literature"]);
    expect(instruction).toMatch(/NO_GAP_ESTABLISHED.*should never become an opportunity/i);
  });
});

describe("buildUserPrompt (Opportunity Agent)", () => {
  it("embeds stakeholders, pains, and gap candidates with their ids", () => {
    const prompt = buildUserPrompt(
      problemAnatomy,
      stakeholderPain,
      existingSolutions,
      gapIntelligence,
    );
    expect(prompt).toContain("[farmer]");
    expect(prompt).toContain("[pain-1]");
    expect(prompt).toContain("[gap-1]");
  });

  it("notes explicitly when Phase 04 found no gap candidates", () => {
    const prompt = buildUserPrompt(problemAnatomy, stakeholderPain, existingSolutions, {
      ...gapIntelligence,
      gapCandidates: [],
    });
    expect(prompt).toMatch(/identified no gap candidates/i);
  });
});
