import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";
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
      description: "Farmers sell blind at harvest time.",
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

const source: PhaseSource = {
  title: "eNAM",
  url: "https://enam.gov.in",
  sourceType: "government",
  retrievedAt: new Date().toISOString(),
  snippet: "A national electronic trading platform.",
  sourceLocalId: "source-1",
  query: "government crop pricing platform",
  category: "GOVERNMENT",
};

describe("buildSystemInstruction (Existing Solution Agent)", () => {
  it("forbids treating a source result as automatically verified beyond what it states", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/does NOT prove/i);
  });

  it("requires citing a real sourceLocalId and forbids inventing one", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/never invent a source id/i);
  });

  it("says zero solutions is an acceptable, honest outcome", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/completely acceptable.*report zero solutions/i);
  });

  it("requires the literal string UNKNOWN for unresolved descriptive fields", () => {
    const instruction = buildSystemInstruction("PBL", ["literature"]);
    expect(instruction).toMatch(/"UNKNOWN"/);
  });
});

describe("buildUserPrompt (Existing Solution Agent)", () => {
  it("lists sources with their sourceLocalId for citation", () => {
    const prompt = buildUserPrompt(problemAnatomy, stakeholderPain, [source], {
      queriesExecuted: 3,
      researchFailures: 0,
      budgetExhausted: false,
    });
    expect(prompt).toContain("[source-1]");
    expect(prompt).toContain("https://enam.gov.in");
  });

  it("tells the model plainly when no sources were retrieved", () => {
    const prompt = buildUserPrompt(problemAnatomy, stakeholderPain, [], {
      queriesExecuted: 0,
      researchFailures: 0,
      budgetExhausted: true,
    });
    expect(prompt).toMatch(/no sources were retrieved/i);
    expect(prompt).toMatch(/research capacity was exhausted/i);
  });
});
