import { describe, expect, it } from "vitest";

import { classifySourceType } from "./classify";

describe("classifySourceType", () => {
  it("classifies .gov domains as government", () => {
    expect(classifySourceType("https://www.usda.gov/report")).toBe(
      "government",
    );
  });

  it("classifies .edu domains as academic", () => {
    expect(classifySourceType("https://web.mit.edu/paper")).toBe("academic");
  });

  it("classifies arxiv as academic", () => {
    expect(classifySourceType("https://arxiv.org/abs/1234.5678")).toBe(
      "academic",
    );
  });

  it("classifies github as open_source", () => {
    expect(classifySourceType("https://github.com/org/repo")).toBe(
      "open_source",
    );
  });

  it("falls back to industry for an unrecognized domain", () => {
    expect(classifySourceType("https://example.com/blog")).toBe("industry");
  });

  it("falls back to industry for a malformed URL rather than throwing", () => {
    expect(classifySourceType("not a url")).toBe("industry");
  });
});
