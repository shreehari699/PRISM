import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
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
      currentWorkaround: {
        claim: "Ask neighboring traders informally.",
        status: "ASSUMPTION",
        reasoning: "Common in similar contexts.",
      },
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

describe("buildSystemInstruction (Research Agent)", () => {
  it("instructs generating multiple targeted queries, never one giant query", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/never one giant catch-all query/i);
  });

  it("lists the nine research categories", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    for (const category of [
      "COMMERCIAL",
      "STARTUP",
      "GOVERNMENT",
      "ACADEMIC",
      "OPEN_SOURCE",
      "INTERNATIONAL",
      "TECHNOLOGY",
      "WORKFLOW",
      "ALTERNATIVE",
    ]) {
      expect(instruction).toContain(category);
    }
  });

  it("distrusts the model's own memory of real companies", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/treat your own knowledge as unreliable/i);
  });
});

describe("buildUserPrompt (Research Agent)", () => {
  it("embeds the problem restatement, stakeholder, primary pain, and known workaround", () => {
    const prompt = buildUserPrompt(problemAnatomy, stakeholderPain);
    expect(prompt).toContain("Smallholder farmers lack real-time crop pricing.");
    expect(prompt).toContain("Smallholder farmer");
    expect(prompt).toContain("No price visibility");
    expect(prompt).toContain("Ask neighboring traders informally.");
  });

  it("says no workaround is documented when none exists", () => {
    const withoutWorkaround: StakeholderPainAnalysis = {
      ...stakeholderPain,
      painPoints: [
        { ...stakeholderPain.painPoints[0], currentWorkaround: undefined },
      ],
    };
    const prompt = buildUserPrompt(problemAnatomy, withoutWorkaround);
    expect(prompt).toMatch(/no current workaround is documented/i);
  });
});
