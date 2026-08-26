import { z } from "zod";

/**
 * Aggregate, phase-level confidence qualifier — distinct from
 * `EvidenceStatus` (which tags one claim) and `Score.confidence` (which
 * qualifies one numeric estimate). This is PRISM's answer to "overall,
 * how much should a human trust this phase's output?", and
 * `INSUFFICIENT_EVIDENCE` is a first-class, expected value — a phase
 * that honestly reports it is not a failed phase.
 */
export const confidenceLevelSchema = z.enum([
  "STRONG",
  "MODERATE",
  "WEAK",
  "INSUFFICIENT_EVIDENCE",
]);

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  STRONG: "Strong",
  MODERATE: "Moderate",
  WEAK: "Weak",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence",
};
