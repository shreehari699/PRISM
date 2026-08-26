import { describe, expect, it } from "vitest";

import { PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";

import { getPhaseExecutor } from "./registry";

const IMPLEMENTED: PrismPhaseKey[] = [
  "problem_intelligence",
  "stakeholder_pain",
  "existing_solutions",
];

describe("getPhaseExecutor", () => {
  it.each(IMPLEMENTED)("returns an executor for %s", (key) => {
    const executor = getPhaseExecutor(key);
    expect(executor).toBeDefined();
    expect(typeof executor?.execute).toBe("function");
  });

  it("returns undefined for every not-yet-implemented phase, rather than a fake executor", () => {
    const notYetImplemented = PHASE_KEYS.filter((key) => !IMPLEMENTED.includes(key));
    for (const key of notYetImplemented) {
      expect(getPhaseExecutor(key)).toBeUndefined();
    }
  });
});
