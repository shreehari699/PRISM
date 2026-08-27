import { z } from "zod";

import { feasibilityAgentOutputSchema } from "@/lib/agents/feasibility-agent/schema";

/**
 * "NONE_IDENTIFIED" is computed by the composer from `criticalBlockers`'
 * length, never asked of the model as a literal string to write — the
 * same "derive, don't ask twice" discipline every prior phase composer
 * applies.
 */
export const criticalBlockersSummarySchema = z.enum(["NONE_IDENTIFIED", "BLOCKERS_IDENTIFIED"]);
export type CriticalBlockersSummary = z.infer<typeof criticalBlockersSummarySchema>;

/**
 * Phase 07's persisted output: the Feasibility Agent's own output, plus
 * what the composer computes — `evidenceSummary`'s numeric count and
 * `criticalBlockersSummary` — the same split Phase 04's gap-intelligence
 * composer establishes between agent-supplied narrative and
 * composer-computed numbers.
 */
export const technicalFeasibilityAnalysisSchema = feasibilityAgentOutputSchema
  .omit({ evidenceSummary: true })
  .extend({
    evidenceSummary: z.object({
      totalSourcesReferenced: z.number().int().nonnegative(),
      verifiedClaimsCount: z.number().int().nonnegative(),
      narrative: z.string().min(1),
    }),
    criticalBlockersSummary: criticalBlockersSummarySchema,
  });
export type TechnicalFeasibilityAnalysis = z.infer<typeof technicalFeasibilityAnalysisSchema>;
