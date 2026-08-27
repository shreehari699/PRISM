import { z } from "zod";

import { qualitativeLevelSchema } from "./scoring";

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

/**
 * A richer evidence claim for phases that cite multiple, phase-local
 * source ids (e.g. a Phase 03 `sourceLocalId` slug, not a DB UUID) and
 * want their own per-claim confidence — first introduced for Phase 04's
 * gap model, promoted here once Phase 05 needed the identical shape
 * rather than a second phase defining its own copy. A `VERIFIED` claim
 * with zero cited sources is rejected at the schema level; whether a
 * cited id actually *exists* is the composer's job, since only it has
 * the real source list to check against.
 */
export const richEvidenceClaimSchema = z
  .object({
    claim: z.string().min(1),
    status: evidenceStatusSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
    confidence: qualitativeLevelSchema,
    reasoning: z.string().min(1),
  })
  .superRefine((claim, ctx) => {
    if (claim.status === "VERIFIED" && claim.sourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "A VERIFIED claim must cite at least one source id.",
        path: ["sourceIds"],
      });
    }
  });

export type RichEvidenceClaim = z.infer<typeof richEvidenceClaimSchema>;

/**
 * Walks an arbitrary parsed-output tree and collects every string found
 * under a `sourceIds` array anywhere in it — every claim/marketNumber
 * schema across every phase uses that exact field name for citations, so
 * this one generic walk replaces having to enumerate each of the dozens
 * of individual claim/number fields by hand in every phase composer,
 * while still being conservative: it can only ever find MORE citations
 * to validate, never fewer. First introduced for Phase 06's composer,
 * promoted here once Phase 07 needed the identical walk.
 */
export function collectCitedSourceIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCitedSourceIds(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "sourceIds" && Array.isArray(val)) {
        for (const id of val) {
          if (typeof id === "string") into.add(id);
        }
      } else {
        collectCitedSourceIds(val, into);
      }
    }
  }
}
