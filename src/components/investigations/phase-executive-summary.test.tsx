// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhaseExecutiveSummary } from "./phase-executive-summary";

describe("PhaseExecutiveSummary", () => {
  it("shows the real headline and real stat values passed in, never a placeholder", () => {
    render(
      <PhaseExecutiveSummary
        headline="Farmers lack real-time crop pricing."
        stats={[
          { label: "Pain points", value: 3 },
          { label: "Stakeholders", value: 2 },
        ]}
      />,
    );

    expect(screen.getByText("Farmers lack real-time crop pricing.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pain points:", { exact: false })).toBeInTheDocument();
  });

  it("omits the uncertainty line entirely when none is given, rather than showing an empty section", () => {
    render(<PhaseExecutiveSummary headline="h" />);
    expect(screen.queryByText(/major uncertainty/i)).not.toBeInTheDocument();
  });

  it("shows the real uncertainty text when one is given", () => {
    render(<PhaseExecutiveSummary headline="h" uncertainty="Does offline mode matter?" />);
    expect(screen.getByText(/major uncertainty/i)).toBeInTheDocument();
    expect(screen.getByText(/Does offline mode matter\?/)).toBeInTheDocument();
  });
});
