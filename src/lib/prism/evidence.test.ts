import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildRichEvidenceClaimSchema, richEvidenceClaimSchema } from "./evidence";

describe("richEvidenceClaimSchema (static)", () => {
  it("rejects a VERIFIED claim with no cited source", () => {
    const result = richEvidenceClaimSchema.safeParse({
      claim: "x",
      status: "VERIFIED",
      sourceIds: [],
      confidence: "medium",
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildRichEvidenceClaimSchema (dynamic, generation-time constrained)", () => {
  it("accepts a real source id from the supplied list", () => {
    const schema = buildRichEvidenceClaimSchema(["source-1", "source-2"]);
    const result = schema.safeParse({
      claim: "x",
      status: "VERIFIED",
      sourceIds: ["source-1"],
      confidence: "medium",
      reasoning: "y",
    });
    expect(result.success).toBe(true);
  });

  // The literal production bug this exists to prevent: a gap id ending
  // up in a sourceIds field. With a dynamic per-call schema, this is now
  // rejected by the schema itself (and would be excluded from what
  // Gemini's structured output can even emit), not only by the
  // composer's later cross-reference check.
  it("rejects a gap id (or any id outside the supplied source list) in sourceIds", () => {
    const schema = buildRichEvidenceClaimSchema(["source-1", "source-2"]);
    const result = schema.safeParse({
      claim: "x",
      status: "INFERENCE",
      sourceIds: ["GAP-01"],
      confidence: "medium",
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });

  it("still enforces VERIFIED-requires-a-real-source, same as the static schema", () => {
    const schema = buildRichEvidenceClaimSchema(["source-1"]);
    const result = schema.safeParse({
      claim: "x",
      status: "VERIFIED",
      sourceIds: [],
      confidence: "medium",
      reasoning: "y",
    });
    expect(result.success).toBe(false);
  });

  it("forces sourceIds empty when there are no real sources available for this call", () => {
    const schema = buildRichEvidenceClaimSchema([]);
    expect(
      schema.safeParse({
        claim: "x",
        status: "INFERENCE",
        sourceIds: ["source-1"],
        confidence: "medium",
        reasoning: "y",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        claim: "x",
        status: "INFERENCE",
        sourceIds: [],
        confidence: "medium",
        reasoning: "y",
      }).success,
    ).toBe(true);
  });

  it("produces a JSON Schema with a real enum constraint on sourceIds, so Gemini's structured output can honor it at generation time", () => {
    const schema = buildRichEvidenceClaimSchema(["source-1", "source-2"]);
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as unknown as {
      properties: { sourceIds: { items: { enum?: string[] } } };
    };
    expect(jsonSchema.properties.sourceIds.items.enum).toEqual(["source-1", "source-2"]);
  });
});
