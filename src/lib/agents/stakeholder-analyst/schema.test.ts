import { describe, expect, it } from "vitest";

import { draftStakeholderSchema, stakeholderAnalystOutputSchema } from "./schema";

function claim(status: "INFERENCE" | "ASSUMPTION" = "INFERENCE") {
  return { claim: "x", status, reasoning: "y" };
}

const validStakeholder = {
  localId: "farmer",
  name: "Smallholder farmer",
  category: "PRIMARY",
  roles: ["USER", "AFFECTED_PARTY"],
  relationshipToProblem: claim(),
  context: "Sells crops at harvest.",
  decisionPower: "none",
  influence: "low",
  urgency: "high",
  impact: "high",
  confidence: "medium",
};

describe("draftStakeholderSchema", () => {
  it("accepts a well-formed stakeholder", () => {
    expect(draftStakeholderSchema.safeParse(validStakeholder).success).toBe(true);
  });

  it("allows decisionPower to be 'none', distinct from 'low'", () => {
    const result = draftStakeholderSchema.parse(validStakeholder);
    expect(result.decisionPower).toBe("none");
  });

  it("requires at least one role", () => {
    const result = draftStakeholderSchema.safeParse({
      ...validStakeholder,
      roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invented role", () => {
    const result = draftStakeholderSchema.safeParse({
      ...validStakeholder,
      roles: ["SHAREHOLDER"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invented tier", () => {
    const result = draftStakeholderSchema.safeParse({
      ...validStakeholder,
      category: "QUATERNARY",
    });
    expect(result.success).toBe(false);
  });

  it("defaults needs and evidenceClaims to empty arrays", () => {
    const result = draftStakeholderSchema.parse(validStakeholder);
    expect(result.needs).toEqual([]);
    expect(result.evidenceClaims).toEqual([]);
  });

  it("rejects a relationshipToProblem claim with an invented evidence status", () => {
    const result = draftStakeholderSchema.safeParse({
      ...validStakeholder,
      relationshipToProblem: { ...claim(), status: "VERIFIED" },
    });
    // VERIFIED is a structurally valid EvidenceStatus (used by other
    // phases) — this schema can't forbid it by itself, that's the
    // system prompt's job (see prompt.test.ts). Confirm it's at least
    // structurally accepted so we're testing the right boundary.
    expect(result.success).toBe(true);
  });
});

describe("stakeholderAnalystOutputSchema", () => {
  it("requires at least one stakeholder", () => {
    const result = stakeholderAnalystOutputSchema.safeParse({ stakeholders: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed output", () => {
    const result = stakeholderAnalystOutputSchema.safeParse({
      stakeholders: [validStakeholder],
    });
    expect(result.success).toBe(true);
  });
});
