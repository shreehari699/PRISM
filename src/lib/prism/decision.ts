import { z } from "zod";

/**
 * PRISM's terminal recommendation. The product's core honesty guarantee
 * lives here: nothing forces this toward BUILD, and REJECT /
 * RESEARCH_FURTHER must be just as well-supported as BUILD.
 */
export const finalDecisionSchema = z.enum([
  "BUILD",
  "RESEARCH_FURTHER",
  "PARK",
  "REJECT",
]);

export type FinalDecision = z.infer<typeof finalDecisionSchema>;

export const FINAL_DECISION_LABELS: Record<FinalDecision, string> = {
  BUILD: "Build",
  RESEARCH_FURTHER: "Research Further",
  PARK: "Park",
  REJECT: "Reject",
};

export const FINAL_DECISION_DESCRIPTIONS: Record<FinalDecision, string> = {
  BUILD:
    "Evidence across phases supports investing in this solution now.",
  RESEARCH_FURTHER:
    "The evidence gathered so far is insufficient to decide either way.",
  PARK:
    "The problem or opportunity is real but not worth pursuing right now.",
  REJECT:
    "The evidence indicates this should not be pursued as currently framed.",
};

export const decisionRecommendationSchema = z.object({
  decision: finalDecisionSchema,
  reasoning: z.string().min(1),
  /** What would have to change for this decision to flip. */
  reconsiderIf: z.array(z.string().min(1)).default([]),
});

export type DecisionRecommendation = z.infer<
  typeof decisionRecommendationSchema
>;
