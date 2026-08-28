import { describe, expect, it, vi } from "vitest";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";
import type { AiProvider } from "@/lib/ai/types";

import { runInnovationAgent } from "./index";

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

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

const validOutput = {
  assessments: [],
  opportunityLandscape: [],
  opportunityRealityCheck: { signal: "NO_CLEAR_OPPORTUNITY", explanation: "e" },
  consultantMessage: "m",
};

function context() {
  return {
    phaseKey: "opportunity_innovation" as const,
    mode: "HACKATHON" as const,
    criteria: ["demo_feasibility"],
    problemStatement: "Farmers lack access to real-time crop pricing.",
    upstreamOutputs: {},
    userId: "user-1",
  };
}

describe("runInnovationAgent", () => {
  it("calls the provider with a schema accepting a valid assessment for the given opportunities", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInnovationAgent(context(), [opportunity], sources, provider);

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toContain("opp-1");
    expect(call.schema.safeParse(validOutput).success).toBe(true);
  });

  function assessmentWithSourceIds(sourceIds: string[]) {
    return {
      opportunityId: "opp-1",
      innovationDirections: [],
      differentiation: { claim: "x", status: "INFERENCE", sourceIds, confidence: "medium", reasoning: "y" },
      innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      refinedOpportunityState: "PROMISING_OPPORTUNITY",
      validationQuestions: [],
    };
  }

  // The literal production bug, reproduced at the schema-construction
  // level for this agent's own sourceIds field.
  it("builds a schema that rejects a gap id used as differentiation.sourceIds", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runInnovationAgent(context(), [opportunity], sources, provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    const withGapAsSource = {
      assessments: [assessmentWithSourceIds(["gap-1"])],
      opportunityLandscape: [],
      opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
      consultantMessage: "m",
    };
    const withRealSource = {
      ...withGapAsSource,
      assessments: [assessmentWithSourceIds(["source-1"])],
    };

    expect(call.schema.safeParse(withGapAsSource).success).toBe(false);
    expect(call.schema.safeParse(withRealSource).success).toBe(true);
  });

  it("builds a schema that rejects an assessment referencing an opportunity id that wasn't actually given", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runInnovationAgent(context(), [opportunity], sources, provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(
      call.schema.safeParse({
        assessments: [{ ...assessmentWithSourceIds([]), opportunityId: "ghost-opp" }],
        opportunityLandscape: [],
        opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
        consultantMessage: "m",
      }).success,
    ).toBe(false);
  });

  it("passes an empty opportunity list through without erroring", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInnovationAgent(context(), [], sources, provider);

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toMatch(/identified no candidate opportunities/i);
  });

  // The actual bug this guards against: differentiation.sourceIds is
  // validated by the phase composer against real Phase 03 source ids —
  // if this agent is never shown those ids, it has no way to cite one
  // correctly and reaches for whatever id-shaped tokens ARE in its
  // context (a gap id, a pain id) instead, producing exactly the
  // "unknown source" failure a real Phase 05 run hit in production.
  it("shows the model the real Phase 03 source ids, so it has something valid to cite in differentiation.sourceIds", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    await runInnovationAgent(context(), [opportunity], sources, provider);

    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toContain("source-1");
    expect(call.prompt).toMatch(/research sources/i);
  });
});
