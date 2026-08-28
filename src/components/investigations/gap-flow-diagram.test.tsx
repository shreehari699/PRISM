// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GapFlowDiagram } from "./gap-flow-diagram";
import type { CoverageMatrixEntry, GapCandidate } from "@/lib/agents/gap-agent/schema";

function gap(overrides: Partial<GapCandidate> = {}): GapCandidate {
  return {
    gapId: "gap-1",
    title: "No automated price alerts",
    description: "Farmers must manually check prices.",
    affectedStakeholders: ["farmer"],
    relatedPains: ["pain-1"],
    relatedExistingSolutions: ["sol-1"],
    missingCapability: {
      claim: "No solution auto-alerts farmers on price changes.",
      status: "INFERENCE",
      sourceIds: [],
      confidence: "medium",
      reasoning: "No source describes this capability.",
    },
    whyItMatters: {
      claim: "Farmers miss favorable selling windows.",
      status: "ASSUMPTION",
      sourceIds: [],
      confidence: "medium",
      reasoning: "Reasonable inference from the pain analysis.",
    },
    evidenceClaims: [],
    sourceIds: [],
    gapType: "FUNCTIONAL",
    confidence: "HIGH",
    gapState: "CONFIRMED_GAP",
    validationStatus: "NEEDS_VALIDATION",
    ...overrides,
  } as GapCandidate;
}

function coverageEntry(overrides: Partial<CoverageMatrixEntry> = {}): CoverageMatrixEntry {
  return {
    existingSolutionId: "sol-1",
    stakeholderId: "farmer",
    painId: "pain-1",
    capability: "Price alerting",
    status: "NOT_ESTABLISHED",
    reasoning: "eNAM has no alerting feature.",
    sourceIds: [],
    ...overrides,
  };
}

describe("GapFlowDiagram", () => {
  it("renders a full-width card per gap with its real id, title, and confidence", () => {
    render(<GapFlowDiagram gaps={[gap()]} coverageMatrix={[]} />);

    expect(screen.getByText("gap-1")).toBeInTheDocument();
    expect(screen.getByText("No automated price alerts")).toBeInTheDocument();
    expect(screen.getByText("HIGH confidence")).toBeInTheDocument();
  });

  it("shows capability coverage as a real symbol derived from the actual coverage status, never a fabricated one", () => {
    render(
      <GapFlowDiagram
        gaps={[gap()]}
        coverageMatrix={[
          coverageEntry({ status: "COVERED", capability: "Search" }),
          coverageEntry({ status: "PARTIALLY_COVERED", capability: "Notifications" }),
          coverageEntry({ status: "NOT_ESTABLISHED", capability: "Alerts" }),
        ]}
      />,
    );

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("~")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("never shows a NO_GAP_ESTABLISHED entry as an active gap", () => {
    render(
      <GapFlowDiagram
        gaps={[gap({ gapId: "gap-2", gapState: "NO_GAP_ESTABLISHED" })]}
        coverageMatrix={[]}
      />,
    );

    expect(screen.queryByText("gap-2")).not.toBeInTheDocument();
    expect(screen.getByText(/already addressed by an existing solution/i)).toBeInTheDocument();
  });

  it("shows the real related-existing-solution ids it was compared against", () => {
    render(<GapFlowDiagram gaps={[gap({ relatedExistingSolutions: ["sol-1", "sol-2"] })]} coverageMatrix={[]} />);

    expect(screen.getByText("sol-1")).toBeInTheDocument();
    expect(screen.getByText("sol-2")).toBeInTheDocument();
  });
});
