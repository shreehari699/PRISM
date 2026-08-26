import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { DraftStakeholder } from "@/lib/agents/stakeholder-analyst/schema";

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

const stakeholders: DraftStakeholder[] = [
  {
    localId: "farmer",
    name: "Smallholder farmer",
    category: "PRIMARY",
    roles: ["USER", "AFFECTED_PARTY"],
    relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
    context: "ctx",
    needs: [],
    decisionPower: "none",
    influence: "low",
    urgency: "high",
    impact: "high",
    evidenceClaims: [],
    confidence: "medium",
  },
];

describe("buildSystemInstruction (Pain Analyst)", () => {
  it("requires severity scores to be labeled as estimates, never market facts", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/comparative estimates/i);
    expect(instruction).toMatch(/never present these numbers as market facts/i);
  });

  it("requires reasoning about symptom vs. root pain for primaryPain", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/symptom of something else/i);
  });

  it("instructs honesty about weak pain, unclear stakeholders, and insufficient evidence", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/not supposed to tell the user what they want to hear/i);
    expect(instruction).toMatch(/INSUFFICIENT_EVIDENCE/);
  });

  it("forbids reusing a stock consultant message", () => {
    const instruction = buildSystemInstruction("PBL", ["literature"]);
    expect(instruction).toMatch(/never reuse a stock line/i);
  });
});

describe("buildUserPrompt (Pain Analyst)", () => {
  it("embeds the stakeholder localId so pain points can reference it", () => {
    const prompt = buildUserPrompt(problemAnatomy, stakeholders);
    expect(prompt).toContain("[farmer]");
    expect(prompt).toContain("Smallholder farmer");
  });
});
