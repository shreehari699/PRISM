import { describe, expect, it } from "vitest";

import { constrainSourceIdsInJsonSchema, findUnknownCitedSourceId } from "./source-id-vocabulary";

describe("constrainSourceIdsInJsonSchema", () => {
  it("injects a real enum into a top-level sourceIds property", () => {
    const jsonSchema = {
      type: "object",
      properties: { sourceIds: { type: "array", items: { type: "string", minLength: 1 } } },
    };
    const result = constrainSourceIdsInJsonSchema(jsonSchema, ["source-1", "source-2"]) as {
      properties: { sourceIds: { items: { enum?: string[] } } };
    };
    expect(result.properties.sourceIds.items.enum).toEqual(["source-1", "source-2"]);
  });

  it("finds and constrains sourceIds no matter how deeply nested", () => {
    const jsonSchema = {
      type: "object",
      properties: {
        assessments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              differentiation: {
                type: "object",
                properties: { sourceIds: { type: "array", items: { type: "string" } } },
              },
            },
          },
        },
      },
    };
    const result = constrainSourceIdsInJsonSchema(jsonSchema, ["source-1"]) as {
      properties: {
        assessments: {
          items: { properties: { differentiation: { properties: { sourceIds: { items: { enum?: string[] } } } } } };
        };
      };
    };
    expect(
      result.properties.assessments.items.properties.differentiation.properties.sourceIds.items.enum,
    ).toEqual(["source-1"]);
  });

  it("forces maxItems 0 when the vocabulary is empty, rather than an invalid empty enum", () => {
    const jsonSchema = { type: "object", properties: { sourceIds: { type: "array", items: { type: "string" } } } };
    const result = constrainSourceIdsInJsonSchema(jsonSchema, []) as {
      properties: { sourceIds: { maxItems?: number } };
    };
    expect(result.properties.sourceIds.maxItems).toBe(0);
  });

  it("leaves every non-sourceIds property untouched", () => {
    const jsonSchema = {
      type: "object",
      properties: { claim: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] } },
    };
    const result = constrainSourceIdsInJsonSchema(jsonSchema, ["source-1"]);
    expect(result).toEqual(jsonSchema);
  });
});

describe("findUnknownCitedSourceId", () => {
  it("returns undefined when every cited id is in the vocabulary", () => {
    const value = { claim: { sourceIds: ["source-1"] } };
    expect(findUnknownCitedSourceId(value, ["source-1", "source-2"])).toBeUndefined();
  });

  // The literal production bug.
  it("finds a gap id cited in a sourceIds field, no matter how deeply nested", () => {
    const value = {
      opportunities: [{ unservedNeed: { sourceIds: ["GAP-01"] } }],
    };
    expect(findUnknownCitedSourceId(value, ["source-1"])).toBe("GAP-01");
  });

  it("returns undefined when there are no sourceIds anywhere in the value", () => {
    expect(findUnknownCitedSourceId({ foo: "bar" }, ["source-1"])).toBeUndefined();
  });
});
