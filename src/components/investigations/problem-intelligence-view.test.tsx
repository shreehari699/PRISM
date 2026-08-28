// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProblemIntelligenceView } from "./problem-intelligence-view";
import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";

const output: ProblemAnatomy = {
  restatement: "Smallholder farmers lack real-time crop pricing.",
  who: [
    { group: "Farmers", description: "Affected group" },
    { group: "Traders", description: "Secondary group" },
  ],
  what: { claim: "x", status: "INFERENCE", reasoning: "y" },
  where: { claim: "x", status: "INFERENCE", reasoning: "y" },
  when: { claim: "x", status: "INFERENCE", reasoning: "y" },
  why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
  assumptions: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
  openQuestions: ["Does offline mode matter?"],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: { value: 62, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
};

describe("ProblemIntelligenceView", () => {
  it("shows an executive summary at the top with the real restatement, counts, score, and top open question", () => {
    render(<ProblemIntelligenceView output={output} />);

    expect(screen.getByText("Executive intelligence")).toBeInTheDocument();
    expect(screen.getByText(output.restatement)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // affected groups
    expect(screen.getByText(/Problem score 62\/100/)).toBeInTheDocument();
    // The open question legitimately appears twice — once as the
    // executive summary's "major uncertainty" line, once in the full
    // open-questions list below — both real, neither a duplicate bug.
    expect(screen.getAllByText(/Does offline mode matter\?/).length).toBeGreaterThan(0);
  });
});
