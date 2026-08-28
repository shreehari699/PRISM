import { z } from "zod";

import { idRefArraySchema } from "./id-refs";
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
 * A generation-time-constrained variant of `richEvidenceClaimSchema`:
 * `sourceIds` is a real enum of the ids that actually exist for this
 * call, not an open `string[]` the model is merely instructed to
 * respect. Zod's JSON Schema conversion turns `z.enum(...)` into a real
 * `enum: [...]` constraint in the schema handed to Gemini's structured
 * output — Gemini honors `enum` during controlled generation, so a value
 * outside the list becomes something the model literally cannot emit,
 * not just something it's asked not to. This is the second, stronger
 * layer on top of (never a replacement for) the composer's own
 * post-generation cross-reference check, which still re-validates every
 * output against the real upstream data regardless of what the model
 * was constrained to — a model that ignores its own schema, or a
 * provider that doesn't enforce `enum`, is still caught there.
 *
 * Use this ONLY to build a per-call schema passed to
 * `provider.generateStructured`; parse the result back into the static
 * `richEvidenceClaimSchema`-based output type afterward so downstream
 * code keeps working with plain `sourceIds: string[]`, not a narrowed
 * literal-union type tied to one call's specific id list.
 */
export function buildRichEvidenceClaimSchema(validSourceIds: readonly string[]) {
  return z
    .object({
      claim: z.string().min(1),
      status: evidenceStatusSchema,
      sourceIds: idRefArraySchema(validSourceIds),
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
}

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

/**
 * Counts every object in an arbitrary parsed-output tree whose `status`
 * is literally `"VERIFIED"` — matches both `richEvidenceClaim` and
 * `marketNumber` shapes, since no other status enum used across PRISM's
 * phases takes that exact value. First introduced for Phase 07's
 * composer, promoted here once Phase 08 needed the identical count.
 */
export function countVerifiedClaims(value: unknown): number {
  let count = 0;
  if (Array.isArray(value)) {
    for (const item of value) count += countVerifiedClaims(item);
    return count;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.status === "VERIFIED") count += 1;
    for (const val of Object.values(obj)) count += countVerifiedClaims(val);
  }
  return count;
}
