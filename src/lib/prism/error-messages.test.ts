import { describe, expect, it } from "vitest";

import { humanizePhaseError } from "./error-messages";

describe("humanizePhaseError", () => {
  // The literal production bug: Phase 05's real validation error, verbatim.
  it("humanizes the GAP-001-as-sourceId production error into a friendly headline, preserving the raw text", () => {
    const raw = 'Opportunity "OPP-001" has a claim citing unknown source "GAP-001".';
    const result = humanizePhaseError(raw);
    expect(result.headline).not.toContain("GAP-001");
    expect(result.headline).not.toContain("OPP-001");
    expect(result.detail).toMatch(/invalid or unsupported evidence reference/i);
    expect(result.detail).toMatch(/no unsupported conclusion was accepted/i);
    expect(result.raw).toBe(raw);
  });

  it("humanizes other unknown-reference validation messages the same way", () => {
    expect(humanizePhaseError('Opportunity "opp-1" references unknown gap "ghost".').headline).toMatch(
      /couldn't be completed/i,
    );
    expect(humanizePhaseError('Opportunity "opp-1" references unknown stakeholder "ghost".').detail).toMatch(
      /evidence reference/i,
    );
  });

  it("humanizes an upstream-revalidation failure distinctly", () => {
    const result = humanizePhaseError(
      "Phase 02/03/04 output could not be re-validated while merging Phase 05 output.",
    );
    expect(result.headline).toMatch(/couldn't be re-confirmed/i);
  });

  it("humanizes a usage-limit failure distinctly", () => {
    const result = humanizePhaseError("Daily ai request limit reached (50/day).");
    expect(result.headline).toMatch(/usage limit/i);
  });

  it("keeps client-authored timeout/network copy as the detail rather than demoting it to a generic fallback", () => {
    const timeout = humanizePhaseError(
      "This is taking far longer than expected and may have stalled. Select this phase again to check its latest status, or retry.",
    );
    expect(timeout.detail).toMatch(/select this phase again/i);

    const network = humanizePhaseError("A network error stopped that action from completing. Please try again.");
    expect(network.detail).toMatch(/please try again/i);
  });

  it("falls back to an honest generic line for an unrecognized message, without inventing detail", () => {
    const result = humanizePhaseError("some entirely novel failure text");
    expect(result.headline).toBe("This phase couldn't be completed");
    expect(result.raw).toBe("some entirely novel failure text");
  });

  it("never throws and never loses the raw text for null/empty input", () => {
    expect(humanizePhaseError(null).raw).toBeTruthy();
    expect(humanizePhaseError(undefined).raw).toBeTruthy();
    expect(humanizePhaseError("").raw).toBeTruthy();
  });
});
