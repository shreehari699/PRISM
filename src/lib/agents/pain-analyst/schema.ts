import { z } from "zod";

import { confidenceLevelSchema } from "@/lib/prism/confidence";
import { evidenceClaimSchema } from "@/lib/prism/evidence";
import { qualitativeLevelSchema, scoreSchema } from "@/lib/prism/scoring";

/**
 * Raw 0-100 dimensions behind a pain's severity score. These are
 * PRISM's own comparative estimates for ranking pains against each
 * other — never real-world measurements — which is exactly why they
 * only ever appear bundled with `overall: Score` (basis `ai_estimate`
 * + mandatory reasoning) rather than as bare numbers anywhere in the
 * schema.
 */
export const painSeverityDimensionsSchema = z.object({
  severity: z.number().min(0).max(100),
  frequency: z.number().min(0).max(100),
  reach: z.number().min(0).max(100),
  consequence: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
  /** How satisfied stakeholders already are with their current workaround — high satisfaction argues against urgency, not for it. */
  currentSolutionSatisfaction: z.number().min(0).max(100),
});

export type PainSeverityDimensions = z.infer<typeof painSeverityDimensionsSchema>;

export const painSeverityScoreSchema = z.object({
  dimensions: painSeverityDimensionsSchema,
  /** Must explain, in reasoning, how the dimensions above combine into this value — "why did PRISM give this pain a score of X" has to be answerable from this field alone. */
  overall: scoreSchema,
});

export type PainSeverityScore = z.infer<typeof painSeverityScoreSchema>;

/**
 * A single stakeholder's pain. Every effect field beyond the required
 * core is optional — "not every pain requires every field" — and
 * absent evidence should produce an UNKNOWN-status claim or an omitted
 * field, never a fabricated number.
 */
export const painPointSchema = z.object({
  localId: z.string().min(1),
  /** References a Stakeholder Analyst `localId` — validated for real existence by the phase composer, not just shape here. */
  stakeholderLocalId: z.string().min(1),
  painTitle: z.string().min(1),
  description: z.string().min(1),
  cause: evidenceClaimSchema,
  frequency: evidenceClaimSchema,
  currentWorkaround: evidenceClaimSchema.optional(),
  timeCost: evidenceClaimSchema.optional(),
  financialEffect: evidenceClaimSchema.optional(),
  operationalEffect: evidenceClaimSchema.optional(),
  socialEffect: evidenceClaimSchema.optional(),
  emotionalEffect: evidenceClaimSchema.optional(),
  riskIfUnsolved: evidenceClaimSchema,
  severityScore: painSeverityScoreSchema,
  confidence: qualitativeLevelSchema,
  evidenceClaims: z.array(evidenceClaimSchema).default([]),
});

export type PainPoint = z.infer<typeof painPointSchema>;

/** A judgment call about which pain point is primary/secondary, with mandatory reasoning — never just a pointer. */
export const painRankingSchema = z.object({
  painLocalId: z.string().min(1),
  /** Must address whether this is the real pain or a downstream symptom of something else. */
  reasoning: z.string().min(1),
});

export const customerDistinctionSchema = z.object({
  /** Whether user/customer/buyer/beneficiary/operator meaningfully diverge for this problem — false is a legitimate answer. */
  applicable: z.boolean(),
  notes: z.array(z.string().min(1)).default([]),
});

export const realityCheckSchema = z.object({
  stakeholderConfidence: confidenceLevelSchema,
  painConfidence: confidenceLevelSchema,
  primaryPainConfidence: confidenceLevelSchema,
  evidenceCompleteness: confidenceLevelSchema,
  /** An honest narrative — including "we could not confidently determine X" when that's true. */
  summary: z.string().min(1),
});

export const painAnalystOutputSchema = z.object({
  painPoints: z.array(painPointSchema).min(1),
  primaryPain: painRankingSchema,
  secondaryPains: z.array(painRankingSchema).default([]),
  /** Systemic consequences of leaving the problem unsolved, beyond any one stakeholder's pain. */
  downstreamConsequences: z.array(evidenceClaimSchema).default([]),
  customerDistinction: customerDistinctionSchema,
  /** Questions future research or user interviews should answer — generated from this specific problem, not generic boilerplate. */
  validationQuestions: z.array(z.string().min(1)).min(1),
  realityCheck: realityCheckSchema,
  /** Short, contextual PRISM-voice remark reacting to this phase's actual findings — never a hard-coded line. */
  consultantMessage: z.string().min(1),
});

export type PainAnalystOutput = z.infer<typeof painAnalystOutputSchema>;
