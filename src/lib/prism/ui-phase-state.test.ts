import { describe, expect, it } from "vitest";

import { PHASE_KEYS } from "@/lib/prism/phases";
import type { PhaseStateDTO } from "@/lib/supabase/rows";

import { deriveUiPhaseState } from "./ui-phase-state";

function dto(phaseKey: PhaseStateDTO["phaseKey"], status: PhaseStateDTO["status"]): PhaseStateDTO {
  return {
    phaseKey,
    status,
    version: status === "not_started" ? 0 : 1,
    outputData: null,
    errorMessage: null,
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

describe("deriveUiPhaseState", () => {
  it("marks the first phase as ready when nothing has run yet", () => {
    expect(deriveUiPhaseState([], "problem_intelligence")).toBe("ready");
  });

  it("marks a downstream phase as locked when its requires-approval predecessor hasn't run", () => {
    expect(deriveUiPhaseState([], "stakeholder_pain")).toBe("locked");
  });

  it("unlocks the next phase once its requires-approval predecessor is approved", () => {
    const phases = [dto("problem_intelligence", "approved")];
    expect(deriveUiPhaseState(phases, "stakeholder_pain")).toBe("ready");
  });

  it("stays locked while the predecessor is only awaiting approval, not yet approved", () => {
    const phases = [dto("problem_intelligence", "awaiting_approval")];
    expect(deriveUiPhaseState(phases, "stakeholder_pain")).toBe("locked");
  });

  it("locks a downstream phase when any predecessor failed", () => {
    const phases = [dto("problem_intelligence", "approved"), dto("stakeholder_pain", "failed")];
    expect(deriveUiPhaseState(phases, "existing_solutions")).toBe("locked");
  });

  it("unlocks a phase whose predecessor doesn't require approval once it has any non-failed output", () => {
    // existing_solutions (order 3) does not require approval, so gap_intelligence
    // (order 4) only needs it to have produced output, not to be approved.
    const phases = [dto("problem_intelligence", "approved"), dto("existing_solutions", "awaiting_approval")];
    expect(deriveUiPhaseState(phases, "gap_intelligence")).toBe("locked"); // stakeholder_pain still not_started
  });

  it("passes through a phase's own real status once it has one", () => {
    const phases = [dto("problem_intelligence", "running")];
    expect(deriveUiPhaseState(phases, "problem_intelligence")).toBe("running");
  });

  it("returns not_started for an unknown phase key it can't find a definition for", () => {
    expect(deriveUiPhaseState([], "not_a_real_phase" as never)).toBe("not_started");
  });

  it("computes a coherent state for every real phase key with no phases run yet", () => {
    for (const key of PHASE_KEYS) {
      const state = deriveUiPhaseState([], key);
      expect(["ready", "locked"]).toContain(state);
    }
  });
});
