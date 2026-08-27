import { describe, expect, it } from "vitest";

import {
  discoveryDialogue,
  phaseTransitionDialogue,
  researchDialogue,
  verdictDialogue,
  warningDialogue,
  welcomeDialogue,
} from "./dialogue";

describe("welcomeDialogue", () => {
  it("interpolates the real problem statement", () => {
    expect(welcomeDialogue("Farmers can't see crop prices")).toContain(
      "Farmers can't see crop prices",
    );
  });

  it("truncates a long problem statement instead of speaking the whole thing verbatim", () => {
    const long = "x".repeat(300);
    const line = welcomeDialogue(long);
    expect(line.length).toBeLessThan(long.length);
    expect(line).toContain("…");
  });
});

describe("phaseTransitionDialogue", () => {
  it("includes the real phase order and title, zero-padded", () => {
    expect(phaseTransitionDialogue(2, "Stakeholder & Pain Analysis")).toBe(
      "Phase 02: Stakeholder & Pain Analysis. Let's look closer.",
    );
  });
});

describe("discoveryDialogue and warningDialogue", () => {
  it("include the detail only when one is given", () => {
    expect(discoveryDialogue("three gaps found")).toBe("Here's what I found: three gaps found.");
    expect(discoveryDialogue("three gaps found", "two are confirmed")).toBe(
      "Here's what I found: three gaps found. two are confirmed",
    );
    expect(warningDialogue("no viable opportunity")).toBe(
      "I need to flag something. no viable opportunity.",
    );
  });
});

describe("researchDialogue", () => {
  it("is honest about finding zero sources rather than padding the count", () => {
    expect(researchDialogue(0, "irrigation sensors")).toMatch(/nothing solid enough to cite/);
  });

  it("pluralizes correctly for one vs. many sources", () => {
    expect(researchDialogue(1, "irrigation sensors")).toContain("1 source worth weighing");
    expect(researchDialogue(4, "irrigation sensors")).toContain("4 sources worth weighing");
  });
});

describe("verdictDialogue", () => {
  it("has a distinct opening line for every real dossier decision", () => {
    const decisions = [
      "BUILD",
      "BUILD_WITH_CHANGES",
      "VALIDATE_BEFORE_BUILD",
      "RESEARCH_BEFORE_BUILD",
      "DO_NOT_BUILD",
      "INSUFFICIENT_EVIDENCE",
    ];
    const lines = decisions.map((d) => verdictDialogue(d, "HIGH", "because reasons"));
    expect(new Set(lines).size).toBe(decisions.length);
  });

  it("interpolates the real confidence and reason", () => {
    const line = verdictDialogue("BUILD", "HIGH", "the evidence is strong");
    expect(line).toContain("high");
    expect(line).toContain("the evidence is strong");
  });
});
