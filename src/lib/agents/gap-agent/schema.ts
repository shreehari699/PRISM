import { z } from "zod";

import { richEvidenceClaimSchema, type RichEvidenceClaim } from "@/lib/prism/evidence";
import { scoreSchema } from "@/lib/prism/scoring";

/**
 * Phase 04's own 4-tier confidence vocabulary. Conceptually the same
 * honesty mechanism as `ConfidenceLevel` in prism/confidence.ts
 * (STRONG/MODERATE/WEAK/INSUFFICIENT_EVIDENCE, introduced for Phase 02),
 * but the Phase 04 spec explicitly and repeatedly asks for these exact
 * literal values (HIGH/MEDIUM/LOW/INSUFFICIENT) — kept phase-local
 * rather than silently substituting a different vocabulary than what
 * was asked for.
 */
export const gapConfidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]);
export type GapConfidenceLevel = z.infer<typeof gapConfidenceLevelSchema>;

/**
 * An evidence-tagged claim carrying its own source references and
 * confidence, richer than the shared `EvidenceClaim` (which has a
 * single optional `sourceId` and no confidence of its own) — this
 * phase's spec explicitly wants `source_ids` (plural) and `confidence`
 * on every claim. This is `richEvidenceClaimSchema` from
 * prism/evidence.ts (introduced here for Phase 04, later reused
 * unchanged by Phase 05) re-exported under this phase's original name
 * so nothing else in this module has to change.
 */
export const gapEvidenceClaimSchema = richEvidenceClaimSchema;
export type GapEvidenceClaim = RichEvidenceClaim;

export const gapTypeSchema = z.enum([
  "FUNCTIONAL",
  "TECHNICAL",
  "USER_EXPERIENCE",
  "ACCESSIBILITY",
  "COST",
  "AVAILABILITY",
  "GEOGRAPHIC",
  "LOCALIZATION",
  "INTEGRATION",
  "INTEROPERABILITY",
  "DATA",
  "ACCURACY",
  "RELIABILITY",
  "SPEED",
  "SCALABILITY",
  "DEPLOYMENT",
  "MAINTENANCE",
  "ADOPTION",
  "REGULATORY",
  "WORKFLOW",
  "BUSINESS_MODEL",
  "STAKEHOLDER",
  "OTHER",
]);
export type GapType = z.infer<typeof gapTypeSchema>;

/**
 * The mandatory three-way (plus rejection) classification. A candidate
 * that turns out to already be addressed by an existing solution is
 * NOT a weak gap — it's `NO_GAP_ESTABLISHED`, a different thing
 * entirely, and bucketed separately from the three real gap tiers by
 * the phase composer.
 */
export const gapStateSchema = z.enum([
  "CONFIRMED_GAP",
  "CANDIDATE_GAP",
  "UNVERIFIED_GAP",
  "NO_GAP_ESTABLISHED",
]);
export type GapState = z.infer<typeof gapStateSchema>;

export const gapValidationStatusSchema = z.enum([
  "VALIDATED",
  "NEEDS_VALIDATION",
  "NOT_APPLICABLE",
]);
export type GapValidationStatus = z.infer<typeof gapValidationStatusSchema>;

export const gapCandidateSchema = z.object({
  gapId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /** Phase 02 stakeholder localIds this gap actually affects. */
  affectedStakeholders: z.array(z.string().min(1)).default([]),
  /** Phase 02 pain localIds this gap traces back to. */
  relatedPains: z.array(z.string().min(1)).default([]),
  /** Phase 03 solution localIds considered when evaluating this candidate. */
  relatedExistingSolutions: z.array(z.string().min(1)).default([]),
  missingCapability: gapEvidenceClaimSchema,
  whyItMatters: gapEvidenceClaimSchema,
  evidenceClaims: z.array(gapEvidenceClaimSchema).default([]),
  /** Phase 03 sourceLocalIds cited in support of this gap overall. */
  sourceIds: z.array(z.string().min(1)).default([]),
  gapType: gapTypeSchema,
  confidence: gapConfidenceLevelSchema,
  gapState: gapStateSchema,
  validationStatus: gapValidationStatusSchema,
});
export type GapCandidate = z.infer<typeof gapCandidateSchema>;

export const coverageStatusSchema = z.enum([
  "COVERED",
  "PARTIALLY_COVERED",
  "NOT_ESTABLISHED",
  "UNKNOWN",
]);
export type CoverageStatus = z.infer<typeof coverageStatusSchema>;

/**
 * One cell of the Existing Solution × Stakeholder × Pain × Capability
 * matrix, flattened into a sparse list — the model only reports
 * combinations it can actually reason about, never an exhaustive
 * cartesian product padded with guesses. `NOT_ESTABLISHED` means the
 * sources never addressed this combination either way; it is
 * deliberately not the same thing as "not covered."
 */
export const coverageMatrixEntrySchema = z.object({
  existingSolutionId: z.string().min(1),
  stakeholderId: z.string().min(1),
  painId: z.string().min(1),
  capability: z.string().min(1),
  status: coverageStatusSchema,
  reasoning: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).default([]),
});
export type CoverageMatrixEntry = z.infer<typeof coverageMatrixEntrySchema>;

export const gapPriorityDimensionsSchema = z.object({
  painSeverity: scoreSchema.optional(),
  stakeholderImpact: scoreSchema.optional(),
  solutionCoverageGap: scoreSchema.optional(),
  gapConfidence: scoreSchema.optional(),
  frequency: scoreSchema.optional(),
  consequence: scoreSchema.optional(),
  strategicRelevance: scoreSchema.optional(),
});
export type GapPriorityDimensions = z.infer<typeof gapPriorityDimensionsSchema>;

/**
 * `overallPriority` reuses the existing `Score` type unmodified — its
 * `basis: "ai_estimate"` field is exactly the "MODEL_ESTIMATE" label
 * the spec asks for; no new labeling vocabulary was needed.
 */
export const gapPriorityEntrySchema = z.object({
  gapId: z.string().min(1),
  overallPriority: scoreSchema,
  dimensions: gapPriorityDimensionsSchema,
});
export type GapPriorityEntry = z.infer<typeof gapPriorityEntrySchema>;

export const gapRealitySignalSchema = z.enum([
  "STRONG_GAP_SIGNAL",
  "MODERATE_GAP_SIGNAL",
  "WEAK_GAP_SIGNAL",
  "NO_CLEAR_GAP",
  "INSUFFICIENT_EVIDENCE",
]);
export type GapRealitySignal = z.infer<typeof gapRealitySignalSchema>;

export const gapRealityCheckSchema = z.object({
  signal: gapRealitySignalSchema,
  /** Must explain *why*, grounded in this run's actual findings — never boilerplate. */
  explanation: z.string().min(1),
});
export type GapRealityCheck = z.infer<typeof gapRealityCheckSchema>;

/**
 * What the Gap Agent itself produces. Aggregate counts
 * (totalSourcesReferenced, verifiedClaimsCount) are deliberately absent
 * here — the phase composer computes those from the pipeline's own
 * data, the same "no fake numbers" discipline Phase 03 established, and
 * adds them when building the final persisted output (see
 * src/lib/phases/gap-intelligence).
 */
export const gapAgentOutputSchema = z.object({
  problemSummary: z.string().min(1),
  stakeholderSummary: z.string().min(1),
  solutionLandscapeSummary: z.string().min(1),
  /**
   * Every evaluated candidate, tagged with its `gapState` — including
   * `NO_GAP_ESTABLISHED` ones. The phase composer derives the
   * confirmed/candidate/unverified/no-gap buckets from this single list
   * by filtering on `gapState`, rather than asking the model to repeat
   * the same data across four separate arrays.
   */
  gapCandidates: z.array(gapCandidateSchema).default([]),
  coverageMatrix: z.array(coverageMatrixEntrySchema).default([]),
  gapPriority: z.array(gapPriorityEntrySchema).default([]),
  gapRealityCheck: gapRealityCheckSchema,
  /** Questions Phase 03's research didn't conclusively answer — persisted for future validation, not chased automatically. */
  validationQuestions: z.array(z.string().min(1)).default([]),
  evidenceSummary: z.object({
    narrative: z.string().min(1),
  }),
  confidenceSummary: z.object({
    overallConfidence: gapConfidenceLevelSchema,
    narrative: z.string().min(1),
  }),
  /** Short, contextual PRISM-voice remark reacting to the actual findings — never a hard-coded line. */
  consultantMessage: z.string().min(1),
});

export type GapAgentOutput = z.infer<typeof gapAgentOutputSchema>;
