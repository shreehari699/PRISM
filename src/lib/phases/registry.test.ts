import { describe, expect, it } from "vitest";

import { PHASE_KEYS } from "@/lib/prism/phases";

import { getPhaseExecutor } from "./registry";

describe("getPhaseExecutor", () => {
  it("returns an executor for problem_intelligence", () => {
    const executor = getPhaseExecutor("problem_intelligence");
    expect(executor).toBeDefined();
    expect(typeof executor?.execute).toBe("function");
  });

  it("returns undefined for every not-yet-implemented phase, rather than a fake executor", () => {
    const notYetImplemented = PHASE_KEYS.filter(
      (key) => key !== "problem_intelligence",
    );
    for (const key of notYetImplemented) {
      expect(getPhaseExecutor(key)).toBeUndefined();
    }
  });
});
