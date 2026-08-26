import { describe, expect, it } from "vitest";

import { problemAnatomySchema } from "./schema";

function validClaim(status: "INFERENCE" | "ASSUMPTION" = "INFERENCE") {
  return {
    claim: "Farmers cannot see real-time prices before harvest.",
    status,
    reasoning: "Stated directly in the problem statement.",
  };
}

const validAnatomy = {
  restatement: "Smallholder farmers lack access to real-time crop pricing.",
  who: [{ group: "Smallholder farmers", description: "Sell crops at harvest time." }],
  what: validClaim(),
  where: validClaim(),
  when: validClaim(),
  why: [validClaim("ASSUMPTION")],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: {
    value: 62,
    basis: "ai_estimate",
    reasoning: "Clearly stated but lacks quantified severity.",
    confidence: "medium",
  },
};

describe("problemAnatomySchema", () => {
  it("accepts a well-formed problem anatomy", () => {
    expect(problemAnatomySchema.safeParse(validAnatomy).success).toBe(true);
  });

  it("requires at least one stakeholder group in `who`", () => {
    const result = problemAnatomySchema.safeParse({ ...validAnatomy, who: [] });
    expect(result.success).toBe(false);
  });

  it("requires at least one root cause in `why`", () => {
    const result = problemAnatomySchema.safeParse({ ...validAnatomy, why: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a claim with an invented evidence status", () => {
    const result = problemAnatomySchema.safeParse({
      ...validAnatomy,
      what: { ...validClaim(), status: "PROVEN" },
    });
    expect(result.success).toBe(false);
  });

  it("defaults assumptions and openQuestions to empty arrays", () => {
    const result = problemAnatomySchema.parse(validAnatomy);
    expect(result.assumptions).toEqual([]);
    expect(result.openQuestions).toEqual([]);
  });

  it("requires a score with reasoning and confidence, not a bare number", () => {
    const result = problemAnatomySchema.safeParse({
      ...validAnatomy,
      problemScore: { value: 62 },
    });
    expect(result.success).toBe(false);
  });
});
