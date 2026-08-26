import { z } from "zod";

import { opportunityStateSchema } from "@/lib/agents/opportunity-agent/schema";
import { richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { qualitativeLevelSchema, scoreSchema } from "@/lib/prism/scoring";

export const innovationDirectionTypeSchema = z.enum([
  "SOFTWARE",
  "HARDWARE",
  "AI_ML",
  "AUTOMATION",
  "DATA",
  "WORKFLOW",
  "SERVICE",
  "INFRASTRUCTURE",
  "POLICY_PROCESS",
  "MARKETPLACE",
  "HYBRID",
]);
export type InnovationDirectionType = z.infer<typeof innovationDirectionTypeSchema>;

export const aiJustificationClassificationSchema = z.enum([
  "AI_REQUIRED",
  "AI_USEFUL",
  "AI_OPTIONAL",
  "AI_NOT_JUSTIFIED",
]);
export type AiJustificationClassification = z.infer<
  typeof aiJustificationClassificationSchema
>;

/**
 * The mandatory anti-AI-hype check attached to every innovation
 * direction. `reasoning` must explain the classification and, whenever
 * it isn't AI_REQUIRED, say what would actually work better (a
 * deterministic algorithm, hardware, a process redesign, or no new
 * technology at all) rather than defaulting to "add AI" by habit.
 */
export const aiJustificationSchema = z.object({
  classification: aiJustificationClassificationSchema,
  reasoning: z.string().min(1),
});
export type AiJustification = z.infer<typeof aiJustificationSchema>;

/**
 * One candidate way to address an opportunity. Only categories that
 * genuinely fit an opportunity should be proposed — the eleven types are
 * a vocabulary, not a checklist to fill out.
 */
export const innovationDirectionSchema = z.object({
  directionType: innovationDirectionTypeSchema,
  whyItCouldAddressTheGap: z.string().min(1),
  whatItWouldChange: z.string().min(1),
  stakeholderBenefit: z.string().min(1),
  newCapability: z.string().min(1),
  assumptionsRequired: z.array(z.string().min(1)).default([]),
  aiJustification: aiJustificationSchema,
});
export type InnovationDirection = z.infer<typeof innovationDirectionSchema>;

export const opportunityRealitySignalSchema = z.enum([
  "STRONG",
  "PROMISING",
  "SPECULATIVE",
  "NO_CLEAR_OPPORTUNITY",
  "INSUFFICIENT_EVIDENCE",
]);
export type OpportunityRealitySignal = z.infer<typeof opportunityRealitySignalSchema>;

/** Dynamically generated per run — never a hard-coded boilerplate line. */
export const opportunityRealityCheckSchema = z.object({
  signal: opportunityRealitySignalSchema,
  explanation: z.string().min(1),
});
export type OpportunityRealityCheck = z.infer<typeof opportunityRealityCheckSchema>;

/**
 * The Innovation Agent's assessment of one opportunity produced by the
 * Opportunity Agent. `refinedOpportunityState` may confirm or downgrade
 * the draft's own `opportunityState` — e.g. a PROMISING_OPPORTUNITY with
 * no viable innovation direction found should come back downgraded, not
 * left exactly as first assessed. `differentiation` is a
 * `richEvidenceClaim` rather than free text so the same
 * VERIFIED-needs-a-source discipline applies; the phase composer
 * additionally rejects "first"/"only"/"unique"/"world's first" language
 * whenever `status` isn't VERIFIED.
 */
export const innovationAssessmentSchema = z.object({
  opportunityId: z.string().min(1),
  /** Empty is valid — some opportunities genuinely have no viable innovation direction yet. */
  innovationDirections: z.array(innovationDirectionSchema).default([]),
  differentiation: richEvidenceClaimSchema,
  innovationPotential: scoreSchema,
  feasibilityPotential: scoreSchema,
  refinedOpportunityState: opportunityStateSchema,
  /** For uncertain opportunities — never fabricate an answer instead. */
  validationQuestions: z.array(z.string().min(1)).default([]),
});
export type InnovationAssessment = z.infer<typeof innovationAssessmentSchema>;

/**
 * A per-opportunity comparison row across every landscape dimension the
 * spec asks for. Every draft opportunity gets one entry — weaker
 * opportunities are never dropped, only ranked lower. The composer
 * computes an ordinal `rank` from these qualitative levels; it is never
 * asked of the model as a bare number.
 */
export const opportunityLandscapeEntrySchema = z.object({
  opportunityId: z.string().min(1),
  stakeholderValue: qualitativeLevelSchema,
  painRelevance: qualitativeLevelSchema,
  gapStrength: qualitativeLevelSchema,
  differentiationStrength: qualitativeLevelSchema,
  innovationStrength: qualitativeLevelSchema,
  feasibilityStrength: qualitativeLevelSchema,
  impactStrength: qualitativeLevelSchema,
  confidence: qualitativeLevelSchema,
  reasoning: z.string().min(1),
});
export type OpportunityLandscapeEntry = z.infer<typeof opportunityLandscapeEntrySchema>;

export const innovationAgentOutputSchema = z.object({
  /** One assessment per opportunity it was given — the composer verifies this is exact, no more, no fewer. */
  assessments: z.array(innovationAssessmentSchema).default([]),
  opportunityLandscape: z.array(opportunityLandscapeEntrySchema).default([]),
  opportunityRealityCheck: opportunityRealityCheckSchema,
  /** Short, contextual PRISM-voice remark reacting to the actual findings — never a hard-coded line. */
  consultantMessage: z.string().min(1),
});
export type InnovationAgentOutput = z.infer<typeof innovationAgentOutputSchema>;
