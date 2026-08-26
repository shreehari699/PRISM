import { describe, expect, it, vi } from "vitest";

import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import type { AiProvider } from "@/lib/ai/types";

import { runInnovationAgent } from "./index";
import { innovationAgentOutputSchema } from "./schema";

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
  it("calls the provider with the innovation agent schema and the given opportunities", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInnovationAgent(context(), [opportunity], provider);

    expect(result.status).toBe("ok");
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ schema: innovationAgentOutputSchema }),
    );
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toContain("opp-1");
  });

  it("passes an empty opportunity list through without erroring", async () => {
    const provider = fakeProvider({ status: "ok", model: "x", data: validOutput });

    const result = await runInnovationAgent(context(), [], provider);

    expect(result.status).toBe("ok");
    const call = vi.mocked(provider.generateStructured).mock.calls[0]![0];
    expect(call.prompt).toMatch(/identified no candidate opportunities/i);
  });
});
