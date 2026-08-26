import { describe, expect, it } from "vitest";

import {
  phaseSourceSchema,
  questionGeneratorOutputSchema,
  researchQueryPlanItemSchema,
} from "./schema";

const validQuery = {
  query: "government crop pricing platforms India",
  category: "GOVERNMENT",
  reason: "Farmers are the primary stakeholder and pricing is government-regulated in some regions.",
  targetInformation: "Existing government price-transparency programs.",
};

describe("researchQueryPlanItemSchema", () => {
  it("accepts a well-formed query", () => {
    expect(researchQueryPlanItemSchema.safeParse(validQuery).success).toBe(true);
  });

  it("rejects an invented category", () => {
    const result = researchQueryPlanItemSchema.safeParse({
      ...validQuery,
      category: "MILITARY",
    });
    expect(result.success).toBe(false);
  });

  it("requires a reason, not just a bare query string", () => {
    const result = researchQueryPlanItemSchema.safeParse({
      ...validQuery,
      reason: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("questionGeneratorOutputSchema", () => {
  it("requires at least one query", () => {
    const result = questionGeneratorOutputSchema.safeParse({ queries: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed plan", () => {
    const result = questionGeneratorOutputSchema.safeParse({ queries: [validQuery] });
    expect(result.success).toBe(true);
  });
});

describe("phaseSourceSchema", () => {
  const validSource = {
    title: "eNAM: National Agriculture Market",
    url: "https://enam.gov.in",
    sourceType: "government",
    retrievedAt: new Date().toISOString(),
    snippet: "A pan-India electronic trading platform for agricultural commodities.",
    sourceLocalId: "source-1",
    query: validQuery.query,
    category: "GOVERNMENT",
  };

  it("accepts a source extending the existing researchSourceSchema shape", () => {
    expect(phaseSourceSchema.safeParse(validSource).success).toBe(true);
  });

  it("still requires a valid URL (inherited from researchSourceSchema)", () => {
    const result = phaseSourceSchema.safeParse({ ...validSource, url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("requires sourceLocalId and category on top of the base source shape", () => {
    const result = phaseSourceSchema.safeParse({
      title: validSource.title,
      url: validSource.url,
      sourceType: validSource.sourceType,
      retrievedAt: validSource.retrievedAt,
      snippet: validSource.snippet,
      query: validSource.query,
    });
    expect(result.success).toBe(false);
  });
});
