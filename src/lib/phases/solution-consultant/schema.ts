import { z } from "zod";

import { solutionConsultantOutputSchema } from "@/lib/agents/solution-consultant/schema";

/**
 * Phase 08's persisted output: the Solution Consultant Agent's own
 * output, plus `evidenceSummary`'s composer-computed numeric count —
 * the same split Phase 04/07's composers establish between
 * agent-supplied narrative and composer-computed numbers.
 */
export const solutionConsultantAnalysisSchema = solutionConsultantOutputSchema
  .omit({ evidenceSummary: true })
  .extend({
    evidenceSummary: z.object({
      totalSourcesReferenced: z.number().int().nonnegative(),
      verifiedClaimsCount: z.number().int().nonnegative(),
      narrative: z.string().min(1),
    }),
  });
export type SolutionConsultantAnalysis = z.infer<typeof solutionConsultantAnalysisSchema>;
