import { z } from "zod";

import { gapAgentOutputSchema } from "@/lib/agents/gap-agent/schema";

/**
 * The Gap Agent's own output, plus the two things the phase composer
 * adds after validating it: gapIds bucketed by state (derived by
 * filtering `gapCandidates`, never asked of the model twice) and real
 * evidence counts computed from the pipeline's own data — the same
 * "no fake numbers" discipline Phase 03 established for its research
 * stats.
 */
export const gapIntelligenceAnalysisSchema = gapAgentOutputSchema
  .omit({ evidenceSummary: true })
  .extend({
    confirmedGaps: z.array(z.string()).default([]),
    candidateGaps: z.array(z.string()).default([]),
    unverifiedGaps: z.array(z.string()).default([]),
    noGapFindings: z.array(z.string()).default([]),
    evidenceSummary: z.object({
      totalSourcesReferenced: z.number().int().nonnegative(),
      verifiedClaimsCount: z.number().int().nonnegative(),
      narrative: z.string().min(1),
    }),
  });

export type GapIntelligenceAnalysis = z.infer<typeof gapIntelligenceAnalysisSchema>;
