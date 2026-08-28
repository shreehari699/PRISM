// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GenericPhaseOutput } from "./generic-phase-output";

describe("GenericPhaseOutput", () => {
  it("renders an evidence-status string as a badge rather than plain text", () => {
    render(<GenericPhaseOutput value={{ claim: "x", status: "VERIFIED" }} />);
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
  });

  it("renders nested object keys as title-cased labels", () => {
    render(<GenericPhaseOutput value={{ missingCapability: "offline sync" }} />);
    expect(screen.getByText("Missing Capability")).toBeInTheDocument();
    expect(screen.getByText("offline sync")).toBeInTheDocument();
  });

  it("says 'None.' for an empty array rather than rendering nothing silently", () => {
    render(<GenericPhaseOutput value={[]} />);
    expect(screen.getByText("None.")).toBeInTheDocument();
  });

  it("says 'No data.' for null rather than crashing or rendering blank", () => {
    render(<GenericPhaseOutput value={null} />);
    expect(screen.getByText("No data.")).toBeInTheDocument();
  });

  // The UX density complaint this guards against: an evidence-claim-shaped
  // value (the single most repeated shape across every PRISM phase schema)
  // used to expand into five separate stacked dt/dd rows — Claim, Status,
  // Reasoning, Confidence, Source Ids — for what is functionally one
  // statement. This asserts it now renders as one compact block instead.
  it("renders a claim/status/reasoning object as one compact block, not stacked Claim/Status/Reasoning label rows", () => {
    render(
      <GenericPhaseOutput
        value={{
          claim: "Farmers lack real-time pricing.",
          status: "INFERENCE",
          reasoning: "No source directly confirms this.",
          confidence: "medium",
          sourceIds: [],
        }}
      />,
    );

    expect(screen.getByText("Farmers lack real-time pricing.")).toBeInTheDocument();
    expect(screen.getByText("INFERENCE")).toBeInTheDocument();
    expect(screen.getByText(/Why\? No source directly confirms this\./)).toBeInTheDocument();
    // The old stacked-label rendering used these exact standalone labels —
    // none of them should appear now that this is one compact block.
    expect(screen.queryByText("Claim")).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Reasoning")).not.toBeInTheDocument();
  });

  it("still title-cases and shows a nested key whose value is a bare string, not an evidence claim", () => {
    render(<GenericPhaseOutput value={{ missingCapability: "offline sync" }} />);
    expect(screen.getByText("Missing Capability")).toBeInTheDocument();
  });
});
