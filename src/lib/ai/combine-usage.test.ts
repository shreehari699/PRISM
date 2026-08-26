import { describe, expect, it } from "vitest";

import { combineUsage } from "./combine-usage";

describe("combineUsage", () => {
  it("sums token counts across multiple usages", () => {
    const result = combineUsage(
      { promptTokens: 10, responseTokens: 20, totalTokens: 30 },
      { promptTokens: 5, responseTokens: 15, totalTokens: 20 },
    );
    expect(result).toEqual({ promptTokens: 15, responseTokens: 35, totalTokens: 50 });
  });

  it("returns undefined when every usage is undefined", () => {
    expect(combineUsage(undefined, undefined)).toBeUndefined();
  });

  it("treats a missing usage as zero rather than dropping the total", () => {
    const result = combineUsage(undefined, { totalTokens: 100 });
    expect(result?.totalTokens).toBe(100);
  });

  it("works with three or more usages", () => {
    const result = combineUsage(
      { totalTokens: 10 },
      { totalTokens: 20 },
      { totalTokens: 30 },
    );
    expect(result?.totalTokens).toBe(60);
  });
});
