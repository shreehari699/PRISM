import { describe, expect, it } from "vitest";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";

describe("buildSystemInstruction", () => {
  it("forbids VERIFIED and explains why (no research at this phase)", () => {
    const instruction = buildSystemInstruction("HACKATHON", ["demo_feasibility"]);
    expect(instruction).toMatch(/NEVER VERIFIED/);
    expect(instruction).toMatch(/no research tools/i);
  });

  it("forbids fabricating statistics or organizations", () => {
    const instruction = buildSystemInstruction("STARTUP", ["market"]);
    expect(instruction).toMatch(/Do not fabricate/i);
  });

  it("includes the project mode label and its criteria", () => {
    const instruction = buildSystemInstruction("PBL", ["literature", "methodology"]);
    expect(instruction).toMatch(/Project-Based Learning/);
    expect(instruction).toMatch(/literature, methodology/);
  });
});

describe("buildUserPrompt", () => {
  it("embeds the exact problem statement text", () => {
    const prompt = buildUserPrompt({
      phaseKey: "problem_intelligence",
      mode: "HACKATHON",
      criteria: [],
      problemStatement: "Farmers lack access to real-time crop pricing.",
      upstreamOutputs: {},
    });
    expect(prompt).toContain("Farmers lack access to real-time crop pricing.");
  });
});
