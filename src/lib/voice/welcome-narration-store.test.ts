// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { hasWelcomeNarrationPlayed, markWelcomeNarrationPlayed } from "./welcome-narration-store";

describe("welcome-narration-store", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("reports unplayed for an investigation that has never been marked", () => {
    expect(hasWelcomeNarrationPlayed("investigation-a")).toBe(false);
  });

  it("reports played after marking, and only for that investigation", () => {
    markWelcomeNarrationPlayed("investigation-a");

    expect(hasWelcomeNarrationPlayed("investigation-a")).toBe(true);
    expect(hasWelcomeNarrationPlayed("investigation-b")).toBe(false);
  });
});
