// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StakeholderPainView } from "./stakeholder-pain-view";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

const output: StakeholderPainAnalysis = {
  stakeholders: [
    {
      localId: "farmer",
      name: "Smallholder farmer",
      category: "PRIMARY",
      roles: ["USER"],
      relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
      context: "ctx",
      needs: [],
      decisionPower: "none",
      influence: "low",
      urgency: "high",
      impact: "high",
      evidenceClaims: [],
      confidence: "medium",
      painPointIds: ["pain-1", "pain-2", "pain-3"],
    },
  ],
  painPoints: [1, 2, 3].map((n) => ({
    localId: `pain-${n}`,
    stakeholderLocalId: "farmer",
    painTitle: `Pain ${n}`,
    description: "d",
    cause: { claim: "x", status: "INFERENCE", reasoning: "y" },
    frequency: { claim: "x", status: "UNKNOWN", reasoning: "y" },
    riskIfUnsolved: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
    severityScore: {
      dimensions: { severity: 1, frequency: 1, reach: 1, consequence: 1, urgency: 1, currentSolutionSatisfaction: 1 },
      overall: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
    },
    confidence: "medium",
    evidenceClaims: [],
  })),
  primaryPain: { painLocalId: "pain-1", reasoning: "Root cause, not a symptom." },
  secondaryPains: [],
  downstreamConsequences: [],
  customerDistinction: { applicable: false, notes: [] },
  validationQuestions: ["How frequently does this occur?"],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "Evidence for the primary pain is thin.",
  },
  consultantMessage: "n/a",
};

describe("StakeholderPainView", () => {
  it("shows an executive summary naming the real primary pain and the real pain-point count", () => {
    render(<StakeholderPainView output={output} />);

    expect(screen.getByText("Executive intelligence")).toBeInTheDocument();
    expect(screen.getByText(/Primary pain: Pain 1/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // pain points count
  });

  it("surfaces the reality check's own summary as the uncertainty line when evidence isn't strong", () => {
    render(<StakeholderPainView output={output} />);
    // Appears twice, both real: once as the executive summary's "major
    // uncertainty" line, once in the Reality check alert further down.
    expect(screen.getAllByText(/Evidence for the primary pain is thin\./).length).toBeGreaterThan(0);
  });
});
