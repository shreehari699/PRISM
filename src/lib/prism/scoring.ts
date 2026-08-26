import { z } from "zod";

/**
 * PRISM scores are always model estimates or transparent heuristics —
 * never presented as precise measurements. `basis` and `reasoning` are
 * required on every score so the UI can never render a bare number.
 */
export const scoreBasisSchema = z.enum(["ai_estimate", "heuristic"]);

export type ScoreBasis = z.infer<typeof scoreBasisSchema>;

export const scoreSchema = z.object({
  /** 0-100. Not fake-precise: agents should reason in bands, not decimals. */
  value: z.number().min(0).max(100),
  basis: scoreBasisSchema,
  reasoning: z.string().min(1),
  /** How confident the scorer is in its own estimate — also honest, not padding. */
  confidence: z.enum(["low", "medium", "high"]),
});

export type Score = z.infer<typeof scoreSchema>;

export const SCORE_KINDS = [
  "problem_score",
  "pain_score",
  "opportunity_score",
  "innovation_score",
  "feasibility_score",
  "evidence_confidence",
] as const;

export type ScoreKind = (typeof SCORE_KINDS)[number];

export const SCORE_KIND_LABELS: Record<ScoreKind, string> = {
  problem_score: "Problem Score",
  pain_score: "Pain Score",
  opportunity_score: "Opportunity Score",
  innovation_score: "Innovation Score",
  feasibility_score: "Feasibility Score",
  evidence_confidence: "Evidence Confidence",
};
