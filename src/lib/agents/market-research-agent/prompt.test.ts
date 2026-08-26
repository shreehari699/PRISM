import { describe, expect, it } from "vitest";

import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

const leadingOpportunity: Opportunity = {
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
  innovationDirections: [],
  differentiation: {
    claim: "A potential differentiation.",
    status: "ASSUMPTION",
    sourceIds: [],
    confidence: "medium",
    reasoning: "y",
  },
  innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
  validationQuestions: [],
};

describe("buildSystemInstruction (Market Research Agent)", () => {
  it("forbids generic catch-all queries", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/never a generic catch-all/i);
  });

  it("lists the market research categories", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/MARKET_SIZE/);
    expect(instruction).toMatch(/GEOGRAPHIC/);
  });

  it("allows an empty query list when there is nothing worth researching", () => {
    const instruction = buildSystemInstruction("RESEARCH", ["gap"]);
    expect(instruction).toMatch(/return an empty query list/i);
  });
});

describe("buildUserPrompt (Market Research Agent)", () => {
  it("embeds the leading opportunity's title and description", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", leadingOpportunity);
    expect(prompt).toContain("District-level price transparency service");
  });

  it("tells the model to return an empty query list when there is no leading opportunity", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", null);
    expect(prompt).toMatch(/did not identify a meaningful opportunity/i);
    expect(prompt).toMatch(/empty query list/i);
  });
});
