import { z } from "zod";

import { buildRichEvidenceClaimSchema, evidenceStatusSchema, richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { idRefArraySchema } from "@/lib/prism/id-refs";
import { qualitativeLevelSchema, scoreSchema } from "@/lib/prism/scoring";

export const opportunityStateSchema = z.enum([
  "STRONG_OPPORTUNITY",
  "PROMISING_OPPORTUNITY",
  "EXPLORATORY_OPPORTUNITY",
  "INSUFFICIENT_EVIDENCE",
]);
export type OpportunityState = z.infer<typeof opportunityStateSchema>;

export const whyNowFactorTypeSchema = z.enum([
  "TECHNOLOGY_READINESS",
  "MARKET_SHIFT",
  "POLICY_CHANGE",
  "BEHAVIOR_CHANGE",
  "INFRASTRUCTURE_CHANGE",
  "COST_REDUCTION",
  "NEW_DATA_AVAILABILITY",
  "NEW_REGULATIONS",
  "NEW_UNMET_DEMAND",
]);
export type WhyNowFactorType = z.infer<typeof whyNowFactorTypeSchema>;

/** One "why now" factor — VERIFIED only when the upstream evidence actually supports it, never asserted as a trend from memory. */
export const whyNowFactorSchema = z.object({
  factor: whyNowFactorTypeSchema,
  claim: z.string().min(1),
  status: evidenceStatusSchema,
  reasoning: z.string().min(1),
});
export type WhyNowFactor = z.infer<typeof whyNowFactorSchema>;

export const impactDimensionKeySchema = z.enum([
  "user",
  "community",
  "industry",
  "government",
  "economic",
  "environmental",
  "social",
  "operational",
]);
export type ImpactDimensionKey = z.infer<typeof impactDimensionKeySchema>;

/** Only dimensions genuinely relevant to this opportunity should appear — never a padded full set. */
export const impactAssessmentEntrySchema = z.object({
  dimension: impactDimensionKeySchema,
  description: z.string().min(1),
  status: evidenceStatusSchema,
  reasoning: z.string().min(1),
});
export type ImpactAssessmentEntry = z.infer<typeof impactAssessmentEntrySchema>;

/**
 * An opportunity before innovation directions have been explored.
 * `opportunityState` here is a first-pass judgment — the Innovation
 * Agent may confirm or downgrade it once it's actually tried to find a
 * viable way to address the opportunity (see
 * innovation-agent/schema.ts's `refinedOpportunityState`); the phase
 * composer's merged output carries only the refined value.
 */
export const draftOpportunitySchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  unservedNeed: richEvidenceClaimSchema,
  /** Phase 02 stakeholder localIds this opportunity would serve. */
  affectedStakeholders: z.array(z.string().min(1)).default([]),
  /** Phase 02 pain localIds this opportunity traces back to. */
  relatedPains: z.array(z.string().min(1)).default([]),
  /** Phase 04 gap ids this opportunity is grounded in. */
  relatedGaps: z.array(z.string().min(1)).default([]),
  /** How existing solutions relate to and fall short of this opportunity. */
  existingSolutionContext: richEvidenceClaimSchema,
  whyNow: z.object({
    factors: z.array(whyNowFactorSchema).default([]),
    summary: z.string().min(1),
  }),
  impact: z.array(impactAssessmentEntrySchema).default([]),
  valuePotential: scoreSchema,
  impactPotential: scoreSchema,
  evidenceClaims: z.array(richEvidenceClaimSchema).default([]),
  confidence: qualitativeLevelSchema,
  opportunityState: opportunityStateSchema,
});
export type DraftOpportunity = z.infer<typeof draftOpportunitySchema>;

export const opportunityAgentOutputSchema = z.object({
  /** Deliberately not `.min(1)` — NO_MEANINGFUL_OPPORTUNITY is a valid, honest result. */
  opportunities: z.array(draftOpportunitySchema).default([]),
});
export type OpportunityAgentOutput = z.infer<typeof opportunityAgentOutputSchema>;

/**
 * A generation-time-constrained variant of `opportunityAgentOutputSchema`:
 * every cross-phase reference field (`affectedStakeholders`,
 * `relatedPains`, `relatedGaps`, and every `sourceIds`) is a real enum of
 * the ids that actually exist upstream for this call, not an open
 * `string[]` the model is merely instructed to respect — see
 * `idRefArraySchema` for why this constrains Gemini's structured output
 * itself, not just the prompt. Build this fresh per call from the real
 * Phase 02/04 ids and parse the result back into the plain
 * `OpportunityAgentOutput` type; never a substitute for the composer's
 * own post-generation cross-reference check against the same real data.
 */
export function buildDynamicOpportunityAgentOutputSchema(validIds: {
  stakeholderIds: readonly string[];
  painIds: readonly string[];
  gapIds: readonly string[];
  sourceIds: readonly string[];
}) {
  const claimSchema = buildRichEvidenceClaimSchema(validIds.sourceIds);

  const dynamicDraftOpportunitySchema = z.object({
    opportunityId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    unservedNeed: claimSchema,
    affectedStakeholders: idRefArraySchema(validIds.stakeholderIds),
    relatedPains: idRefArraySchema(validIds.painIds),
    relatedGaps: idRefArraySchema(validIds.gapIds),
    existingSolutionContext: claimSchema,
    whyNow: z.object({
      factors: z.array(whyNowFactorSchema).default([]),
      summary: z.string().min(1),
    }),
    impact: z.array(impactAssessmentEntrySchema).default([]),
    valuePotential: scoreSchema,
    impactPotential: scoreSchema,
    evidenceClaims: z.array(claimSchema).default([]),
    confidence: qualitativeLevelSchema,
    opportunityState: opportunityStateSchema,
  });

  return z.object({
    opportunities: z.array(dynamicDraftOpportunitySchema).default([]),
  });
}
