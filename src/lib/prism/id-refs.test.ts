import { describe, expect, it } from "vitest";

import { idRefArraySchema, idRefSchema, nullableIdRefSchema } from "./id-refs";

describe("idRefArraySchema", () => {
  it("accepts only ids that are actually in the known list", () => {
    const schema = idRefArraySchema(["source-1", "source-2"]);
    expect(schema.safeParse(["source-1"]).success).toBe(true);
    expect(schema.safeParse(["source-1", "source-2"]).success).toBe(true);
  });

  // The literal production bug: a real, valid id from a DIFFERENT
  // namespace (a gap id) must still be rejected here — being "known"
  // somewhere else doesn't make it valid for this field.
  it("rejects a real id from the wrong namespace, not just a nonexistent one", () => {
    const schema = idRefArraySchema(["source-1", "source-2"]);
    expect(schema.safeParse(["GAP-01"]).success).toBe(false);
    expect(schema.safeParse(["ghost-source"]).success).toBe(false);
  });

  it("accepts an empty array regardless of the known list", () => {
    expect(idRefArraySchema(["source-1"]).safeParse([]).success).toBe(true);
    expect(idRefArraySchema([]).safeParse([]).success).toBe(true);
  });

  it("forces the field empty when there are no known ids at all, rather than building an invalid empty enum", () => {
    const schema = idRefArraySchema([]);
    expect(schema.safeParse(["anything"]).success).toBe(false);
    expect(schema.safeParse([]).success).toBe(true);
  });

  it("defaults to an empty array when the field is omitted", () => {
    const schema = idRefArraySchema(["source-1"]);
    expect(schema.parse(undefined)).toEqual([]);
  });
});

describe("idRefSchema", () => {
  it("accepts only a real known id", () => {
    const schema = idRefSchema(["gap-1", "gap-2"]);
    expect(schema.safeParse("gap-1").success).toBe(true);
    expect(schema.safeParse("gap-3").success).toBe(false);
    expect(schema.safeParse("source-1").success).toBe(false);
  });

  it("accepts nothing when there are no known ids", () => {
    expect(idRefSchema([]).safeParse("anything").success).toBe(false);
  });
});

describe("nullableIdRefSchema", () => {
  it("accepts null in addition to a real known id", () => {
    const schema = nullableIdRefSchema(["val-1"]);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("val-1").success).toBe(true);
    expect(schema.safeParse("val-2").success).toBe(false);
  });

  it("accepts only null when there are no known ids", () => {
    const schema = nullableIdRefSchema([]);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("anything").success).toBe(false);
  });
});
