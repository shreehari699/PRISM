import { describe, expect, it } from "vitest";

import { statusVariant } from "./status-chip";

describe("statusVariant", () => {
  it("reads UNKNOWN/INSUFFICIENT statuses as unknown regardless of other words they contain", () => {
    expect(statusVariant("UNKNOWN")).toBe("unknown");
    expect(statusVariant("INSUFFICIENT_EVIDENCE")).toBe("unknown");
  });

  it("reads bad-sounding compound statuses as destructive, not their good-sounding substring", () => {
    expect(statusVariant("UNAVAILABLE")).toBe("destructive");
    expect(statusVariant("NOT_FEASIBLE_NOW")).toBe("destructive");
    expect(statusVariant("INFEASIBLE")).toBe("destructive");
  });

  it("never lets the standalone bad word HIGH override a good compound status like HIGHLY_FEASIBLE", () => {
    expect(statusVariant("HIGHLY_FEASIBLE")).toBe("verified");
  });

  it("reads a bare risk-level HIGH as destructive", () => {
    expect(statusVariant("HIGH")).toBe("destructive");
  });

  it("reads caution-sounding statuses as the assumption (warning) variant", () => {
    expect(statusVariant("CONDITIONALLY_FEASIBLE")).toBe("assumption");
    expect(statusVariant("DIFFICULT")).toBe("assumption");
    expect(statusVariant("MEDIUM")).toBe("assumption");
  });

  it("reads good-sounding statuses as verified", () => {
    expect(statusVariant("FEASIBLE")).toBe("verified");
    expect(statusVariant("AVAILABLE")).toBe("verified");
    expect(statusVariant("READY_TO_BUILD")).toBe("verified");
    expect(statusVariant("LOW")).toBe("verified");
  });

  it("falls back to outline for a status it doesn't recognize", () => {
    expect(statusVariant("SOMETHING_ELSE_ENTIRELY")).toBe("outline");
  });
});
