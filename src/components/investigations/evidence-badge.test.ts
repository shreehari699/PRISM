import { describe, expect, it } from "vitest";

import { evidenceVariant } from "./evidence-badge";

describe("evidenceVariant", () => {
  it("maps every real evidence status to its own badge variant", () => {
    expect(evidenceVariant("VERIFIED")).toBe("verified");
    expect(evidenceVariant("INFERENCE")).toBe("inference");
    expect(evidenceVariant("ASSUMPTION")).toBe("assumption");
    expect(evidenceVariant("RECOMMENDATION")).toBe("recommendation");
    expect(evidenceVariant("UNKNOWN")).toBe("unknown");
  });

  it("treats a market number's MODEL_ESTIMATE status like an inference", () => {
    expect(evidenceVariant("MODEL_ESTIMATE")).toBe("inference");
  });

  it("is case-insensitive", () => {
    expect(evidenceVariant("verified")).toBe("verified");
  });

  it("falls back to unknown for anything else, never fabricating certainty", () => {
    expect(evidenceVariant("SOMETHING_UNEXPECTED")).toBe("unknown");
  });
});
