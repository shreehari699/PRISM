import { describe, expect, it } from "vitest";

import {
  downstreamPhasesOf,
  getPhaseByOrder,
  getPhaseDefinition,
  nextPhase,
  PHASE_KEYS,
  previousPhase,
  PRISM_PHASES,
  upstreamPhasesOf,
} from "./phases";

describe("PRISM_PHASES", () => {
  it("defines exactly ten phases", () => {
    expect(PRISM_PHASES).toHaveLength(10);
  });

  it("orders phases 1 through 10 with no gaps or duplicates", () => {
    const orders = PRISM_PHASES.map((p) => p.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has a unique key per phase", () => {
    expect(new Set(PHASE_KEYS).size).toBe(PHASE_KEYS.length);
  });

  it("ends with the intelligence dossier", () => {
    expect(PRISM_PHASES[PRISM_PHASES.length - 1].key).toBe(
      "intelligence_dossier",
    );
  });

  it("starts with problem intelligence", () => {
    expect(PRISM_PHASES[0].key).toBe("problem_intelligence");
  });
});

describe("getPhaseDefinition", () => {
  it("returns the matching phase", () => {
    expect(getPhaseDefinition("gap_intelligence").order).toBe(4);
  });

  it("throws for an unknown key", () => {
    // @ts-expect-error intentionally invalid
    expect(() => getPhaseDefinition("not_a_phase")).toThrow();
  });
});

describe("phase navigation", () => {
  it("nextPhase returns the following phase", () => {
    expect(nextPhase("problem_intelligence")?.key).toBe("stakeholder_pain");
  });

  it("nextPhase returns undefined after the last phase", () => {
    expect(nextPhase("intelligence_dossier")).toBeUndefined();
  });

  it("previousPhase returns undefined before the first phase", () => {
    expect(previousPhase("problem_intelligence")).toBeUndefined();
  });

  it("getPhaseByOrder is the inverse of .order", () => {
    for (const phase of PRISM_PHASES) {
      expect(getPhaseByOrder(phase.order)?.key).toBe(phase.key);
    }
  });
});

describe("upstream/downstream helpers", () => {
  it("upstreamPhasesOf returns every earlier phase in order", () => {
    expect(upstreamPhasesOf("gap_intelligence")).toEqual([
      "problem_intelligence",
      "stakeholder_pain",
      "existing_solutions",
    ]);
  });

  it("downstreamPhasesOf returns every later phase in order", () => {
    const downstream = downstreamPhasesOf("technical_feasibility");
    expect(downstream).toEqual([
      "solution_consultant",
      "poc_validation",
      "intelligence_dossier",
    ]);
  });

  it("the first phase has no upstream phases", () => {
    expect(upstreamPhasesOf("problem_intelligence")).toEqual([]);
  });

  it("the last phase has no downstream phases", () => {
    expect(downstreamPhasesOf("intelligence_dossier")).toEqual([]);
  });
});
