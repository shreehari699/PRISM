import { describe, expect, it } from "vitest";

import { NoneResearchProvider } from "./none";

describe("NoneResearchProvider", () => {
  it("reports unavailable rather than fabricating results", async () => {
    const provider = new NoneResearchProvider();
    const result = await provider.search({ query: "anything", maxResults: 10 });

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toMatch(/RESEARCH_PROVIDER/);
    }
  });

  it("is always reported as configured", () => {
    expect(new NoneResearchProvider().isConfigured).toBe(true);
  });
});
