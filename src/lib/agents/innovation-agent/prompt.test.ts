import { describe, expect, it } from "vitest";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

const opportunity: DraftOpportunity = {
  opportunityId: "opp-1",
  title: "District-level price transparency service",
  description: "d",
  unservedNeed: {
    claim: "Farmers lack real-time pricing.",
    status: "INFERENCE",
    sourceIds: [],
    confidence: "medium",
    reasoning: "y",
  },
  affectedStakeholders: ["farmer"],
  relatedPains: ["pain-1"],
  relatedGaps: ["gap-1"],
  existingSolutionContext: {
    claim: "No existing solution covers this district.",
    status: "ASSUMPTION",
    sourceIds: [],
    confidence: "medium",
    reasoning: "y",
  },
  whyNow: { factors: [], summary: "s" },
  impact: [],
  valuePotential: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  impactPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  evidenceClaims: [],
  confidence: "medium",
  opportunityState: "PROMISING_OPPORTUNITY",
};

describe("buildSystemInstruction (Innovation Agent)", () => {
  it("states the mandatory anti-AI-hype rule", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/MANDATORY ANTI-AI-HYPE RULE/);
    expect(instruction).toMatch(/AI_NOT_JUSTIFIED/);
  });

  it("forbids overclaiming differentiation without verified evidence", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/never claim 'first', 'only', 'unique'/i);
  });

  it("requires rating every opportunity in the landscape, including weak ones", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/do not omit or hide a weaker opportunity/i);
  });

  it("allows NO_CLEAR_OPPORTUNITY as a legitimate outcome", () => {
    const instruction = buildSystemInstruction("PBL", ["literature"]);
    expect(instruction).toMatch(/legitimate, honest outcome/i);
  });
});

describe("buildUserPrompt (Innovation Agent)", () => {
  it("embeds each opportunity's id and key fields", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", [opportunity]);
    expect(prompt).toContain("[opp-1]");
    expect(prompt).toContain("District-level price transparency service");
  });

  it("tells the model to return an empty assessment set when there are no opportunities", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", []);
    expect(prompt).toMatch(/identified no candidate opportunities/i);
    expect(prompt).toMatch(/do not invent an opportunity/i);
  });
});
