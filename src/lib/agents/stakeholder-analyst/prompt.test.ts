import { describe, expect, it } from "vitest";

import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

const problemAnatomy: ProblemAnatomy = {
  restatement: "Smallholder farmers lack real-time crop pricing.",
  who: [{ group: "Smallholder farmers", description: "Sell crops at harvest." }],
  what: { claim: "Prices are opaque at sale time.", status: "INFERENCE", reasoning: "Stated in the problem statement." },
  where: { claim: "Rural mandis.", status: "ASSUMPTION", reasoning: "Implied by 'smallholder'." },
  when: { claim: "At harvest.", status: "INFERENCE", reasoning: "Directly stated." },
  why: [{ claim: "No access to live price feeds.", status: "ASSUMPTION", reasoning: "No connectivity mentioned." }],
  assumptions: [],
  openQuestions: [],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
};

describe("buildSystemInstruction (Stakeholder Analyst)", () => {
  it("forbids VERIFIED and RECOMMENDATION at this phase", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/NEVER VERIFIED/);
    expect(instruction).toMatch(/NEVER RECOMMENDATION/);
  });

  it("requires preserving Phase 01's evidence statuses rather than changing them", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/preserve that status/i);
  });

  it("explains the user/customer/buyer/beneficiary/operator distinctions", () => {
    const instruction = buildSystemInstruction("ZERO_DEGREE", ["team_fit"]);
    expect(instruction).toMatch(/buyer is not necessarily the beneficiary/i);
  });

  it("explains that decisionPower has a 'none' level distinct from 'low'", () => {
    const instruction = buildSystemInstruction("PBL", ["literature"]);
    expect(instruction).toMatch(/`none`/);
  });
});

describe("buildUserPrompt (Stakeholder Analyst)", () => {
  it("embeds the Phase 01 restatement and preserves evidence status labels", () => {
    const prompt = buildUserPrompt(problemAnatomy);
    expect(prompt).toContain("Smallholder farmers lack real-time crop pricing.");
    expect(prompt).toContain("(ASSUMPTION) No access to live price feeds.");
  });
});
