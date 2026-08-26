import { z } from "zod";

/**
 * Every factual claim PRISM surfaces must be labeled with one of these.
 * This is the mechanism that keeps the product honest instead of
 * confidently hallucinating certainty — never widen this enum to add a
 * vaguer catch-all status.
 */
export const evidenceStatusSchema = z.enum([
  "VERIFIED",
  "INFERENCE",
  "ASSUMPTION",
  "RECOMMENDATION",
  "UNKNOWN",
]);

export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  VERIFIED: "Verified",
  INFERENCE: "Inference",
  ASSUMPTION: "Assumption",
  RECOMMENDATION: "Recommendation",
  UNKNOWN: "Unknown",
};

export const EVIDENCE_STATUS_DESCRIPTIONS: Record<EvidenceStatus, string> = {
  VERIFIED: "Directly supported by a cited, retrievable source.",
  INFERENCE: "Reasoned from verified facts, but not itself directly sourced.",
  ASSUMPTION: "A working premise adopted in the absence of evidence.",
  RECOMMENDATION: "An AI/model judgment call, not a factual claim.",
  UNKNOWN: "Could not be determined with available research.",
};

/** A single evidence-backed claim, optionally citing a research source. */
export const evidenceClaimSchema = z.object({
  claim: z.string().min(1),
  status: evidenceStatusSchema,
  reasoning: z.string().min(1),
  sourceId: z.string().uuid().optional(),
});

export type EvidenceClaim = z.infer<typeof evidenceClaimSchema>;
