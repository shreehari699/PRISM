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
});
