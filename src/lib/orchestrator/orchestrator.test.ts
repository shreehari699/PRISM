import { describe, expect, it } from "vitest";

import type { PhaseState, ProjectContext } from "./types";
import { PrismOrchestrator } from "./orchestrator";

function context(phases: PhaseState[]): ProjectContext {
  return {
    mode: "HACKATHON",
    problemStatement: "Rural farmers lack real-time crop pricing data.",
    phases,
  };
}

describe("PrismOrchestrator.getActivePhase", () => {
  it("returns the first phase when nothing has run", () => {
    const orchestrator = new PrismOrchestrator(context([]));
    expect(orchestrator.getActivePhase()).toBe("problem_intelligence");
  });

  it("advances past approved phases", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: { summary: "ok" },
        },
      ]),
    );
    expect(orchestrator.getActivePhase()).toBe("stakeholder_pain");
  });

  it("stays on a phase awaiting approval", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "awaiting_approval",
          version: 1,
          outputData: { summary: "draft" },
        },
      ]),
    );
    expect(orchestrator.getActivePhase()).toBe("problem_intelligence");
  });
});

describe("PrismOrchestrator.canEnterPhase", () => {
  it("blocks entry when an approval-gated upstream phase isn't approved", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "awaiting_approval",
          version: 1,
          outputData: {},
        },
      ]),
    );
    const gate = orchestrator.canEnterPhase("stakeholder_pain");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/Problem Intelligence/);
  });

  it("allows entry once every upstream approval-gated phase is approved", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: {},
        },
      ]),
    );
    expect(orchestrator.canEnterPhase("stakeholder_pain").allowed).toBe(true);
  });

  it("blocks entry when an upstream phase failed", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: {},
        },
        {
          phaseKey: "stakeholder_pain",
          status: "failed",
          version: 1,
          outputData: null,
        },
      ]),
    );
    const gate = orchestrator.canEnterPhase("existing_solutions");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/failed/);
  });

  it("the first phase has nothing blocking it", () => {
    const orchestrator = new PrismOrchestrator(context([]));
    expect(orchestrator.canEnterPhase("problem_intelligence").allowed).toBe(
      true,
    );
  });
});

describe("PrismOrchestrator.getPhasesRequiringRegeneration", () => {
  it("flags downstream phases that already have output", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: {},
        },
        {
          phaseKey: "stakeholder_pain",
          status: "approved",
          version: 1,
          outputData: {},
        },
        {
          phaseKey: "existing_solutions",
          status: "not_started",
          version: 1,
          outputData: null,
        },
      ]),
    );

    expect(
      orchestrator.getPhasesRequiringRegeneration("problem_intelligence"),
    ).toEqual(["stakeholder_pain"]);
  });

  it("returns nothing when no downstream phase has run yet", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: {},
        },
      ]),
    );
    expect(
      orchestrator.getPhasesRequiringRegeneration("problem_intelligence"),
    ).toEqual([]);
  });
});

describe("PrismOrchestrator.buildExecutionContext", () => {
  it("bundles mode criteria, problem statement, and upstream outputs", () => {
    const orchestrator = new PrismOrchestrator(
      context([
        {
          phaseKey: "problem_intelligence",
          status: "approved",
          version: 1,
          outputData: { summary: "the anatomy" },
        },
      ]),
    );

    const execContext = orchestrator.buildExecutionContext("stakeholder_pain");
    expect(execContext.mode).toBe("HACKATHON");
    expect(execContext.criteria).toContain("demo_feasibility");
    expect(execContext.upstreamOutputs.problem_intelligence).toEqual({
      summary: "the anatomy",
    });
  });
});
