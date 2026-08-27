// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBadge } from "./verdict-badge";

describe("VerdictBadge", () => {
  it("shows 'In progress' rather than inventing a verdict before the dossier has run", () => {
    render(<VerdictBadge decision={null} />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders the real decision label for a known decision", () => {
    render(<VerdictBadge decision="BUILD_WITH_CHANGES" />);
    expect(screen.getByText("Build with changes")).toBeInTheDocument();
  });

  it("falls back to the raw string for an unrecognized decision rather than hiding it", () => {
    render(<VerdictBadge decision="SOME_FUTURE_DECISION" />);
    expect(screen.getByText("SOME_FUTURE_DECISION")).toBeInTheDocument();
  });
});
