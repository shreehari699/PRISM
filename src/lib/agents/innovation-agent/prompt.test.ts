import { describe, expect, it } from "vitest";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

const sources: PhaseSource[] = [
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
];

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

describe("buildSystemInstruction (Innovation Agent) — source/gap id discipline", () => {
  it("tells the model differentiation.sourceIds takes only real research source ids, never an opportunity/gap/pain id", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/differentiation\.sourceIds[\s\S]*only real research source ids/i);
    expect(instruction).toMatch(/never an opportunity id, a gap id, or a pain id/i);
  });
});

describe("buildUserPrompt (Innovation Agent)", () => {
  it("embeds each opportunity's id and key fields", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", [opportunity], sources);
    expect(prompt).toContain("[opp-1]");
    expect(prompt).toContain("District-level price transparency service");
  });

  it("tells the model to return an empty assessment set when there are no opportunities", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", [], sources);
    expect(prompt).toMatch(/identified no candidate opportunities/i);
    expect(prompt).toMatch(/do not invent an opportunity/i);
  });

  // Root-cause regression test: the actual production bug was
  // `Opportunity "OPP-001" has a claim citing unknown source "GAP-001"`
  // — this agent's differentiation.sourceIds is validated against real
  // Phase 03 source ids, but the prompt never showed the model what
  // those were, so it had nothing valid to cite.
  it("shows the real Phase 03 source ids in the prompt so the model has something valid to cite", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", [opportunity], sources);
    expect(prompt).toContain("[source-1]");
    expect(prompt).toMatch(/research sources[\s\S]*only valid values for `differentiation\.sourceIds`/i);
  });

  it("tells the model explicitly when no sources exist, rather than leaving it to guess", () => {
    const prompt = buildUserPrompt("Farmers lack pricing.", [opportunity], []);
    expect(prompt).toMatch(/no research sources are available/i);
    expect(prompt).toMatch(/sourceIds[\s\S]*must stay empty/i);
  });
});
