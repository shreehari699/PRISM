import { z } from "zod";

import { draftOpportunitySchema } from "@/lib/agents/opportunity-agent/schema";
import {
  innovationDirectionSchema,
  opportunityLandscapeEntrySchema,
  opportunityRealityCheckSchema,
} from "@/lib/agents/innovation-agent/schema";
import { richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { scoreSchema } from "@/lib/prism/scoring";

/**
 * The final, merged opportunity: every field the Opportunity Agent
 * drafted, plus what the Innovation Agent assessed for it — its
 * `opportunityState` here is the *refined* state (the Innovation
 * Agent's judgment after actually looking for a viable direction), not
 * the Opportunity Agent's first-pass guess; the draft state is discarded
 * once refined. `innovationPotential`/`feasibilityPotential` complete
 * the four-score Innovation Score set alongside the draft's own
 * `valuePotential`/`impactPotential`.
 */
export const opportunitySchema = draftOpportunitySchema.extend({
  innovationDirections: z.array(innovationDirectionSchema).default([]),
  differentiation: richEvidenceClaimSchema,
  innovationPotential: scoreSchema,
  feasibilityPotential: scoreSchema,
  /** Per-opportunity questions worth resolving before treating this as settled — never fabricated answers. */
  validationQuestions: z.array(z.string().min(1)).default([]),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/** Every draft opportunity gets a ranked entry — weaker ones are surfaced, never hidden. */
export const rankedOpportunityLandscapeEntrySchema = opportunityLandscapeEntrySchema.extend({
  rank: z.number().int().positive(),
});
export type RankedOpportunityLandscapeEntry = z.infer<
  typeof rankedOpportunityLandscapeEntrySchema
>;

export const opportunityOverallFindingSchema = z.enum([
  "MEANINGFUL_OPPORTUNITY_FOUND",
  "NO_MEANINGFUL_OPPORTUNITY",
]);
export type OpportunityOverallFinding = z.infer<typeof opportunityOverallFindingSchema>;

/**
 * Phase 05's persisted output. `overallFinding` is computed by the phase
 * composer from the actual opportunity states, never asked of either
 * agent — concluding NO_MEANINGFUL_OPPORTUNITY is a legitimate, honest
 * result, not a failure.
 */
export const opportunityInnovationAnalysisSchema = z.object({
  opportunities: z.array(opportunitySchema).default([]),
  opportunityLandscape: z.array(rankedOpportunityLandscapeEntrySchema).default([]),
  opportunityRealityCheck: opportunityRealityCheckSchema,
  overallFinding: opportunityOverallFindingSchema,
  consultantMessage: z.string().min(1),
});
export type OpportunityInnovationAnalysis = z.infer<
  typeof opportunityInnovationAnalysisSchema
>;
