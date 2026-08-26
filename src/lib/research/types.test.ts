import { describe, expect, it } from "vitest";

import { researchSourceSchema } from "./types";

describe("researchSourceSchema", () => {
  const valid = {
    title: "Digital agriculture pricing platforms in South Asia",
    url: "https://www.fao.org/report",
    sourceType: "government" as const,
    retrievedAt: new Date().toISOString(),
    snippet: "A report on pricing transparency for smallholder farmers.",
  };

  it("accepts a minimal valid normalized source", () => {
    expect(researchSourceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a source without a valid URL", () => {
    const result = researchSourceSchema.safeParse({
      ...valid,
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized sourceType", () => {
    const result = researchSourceSchema.safeParse({
      ...valid,
      sourceType: "blog",
    });
    expect(result.success).toBe(false);
  });

  it("rejects relevance outside 0-1", () => {
    const result = researchSourceSchema.safeParse({
      ...valid,
      relevance: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional evidence, confidence, and publisher fields", () => {
    const result = researchSourceSchema.safeParse({
      ...valid,
      publisher: "FAO",
      evidence: "Table 3 shows a 22% price variance across regions.",
      confidence: 0.8,
      relevance: 0.9,
      publishedDate: "2025-01-15",
    });
    expect(result.success).toBe(true);
  });
});
