import { z } from "zod";

import { evidenceClaimSchema } from "@/lib/prism/evidence";
import { qualitativeLevelSchema } from "@/lib/prism/scoring";

export const solutionTypeSchema = z.enum([
  "COMPANY",
  "STARTUP",
  "GOVERNMENT_PROGRAM",
  "ACADEMIC_PROJECT",
  "OPEN_SOURCE_PROJECT",
  "PRODUCT",
  "SERVICE",
  "WORKFLOW",
  "OTHER",
]);

export type SolutionType = z.infer<typeof solutionTypeSchema>;

export const deploymentStatusSchema = z.enum([
  "CONCEPT",
  "PILOT",
  "ACTIVE",
  "DISCONTINUED",
  "UNKNOWN",
]);

export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

/**
 * A short descriptive field where "we don't know" is itself the
 * expected, honest value — the model must write the literal string
 * "UNKNOWN" rather than the field being silently absent, so the UI
 * never has to distinguish "omitted" from "checked and unknown."
 * Reserved for plain facts (organization, country, year); anything that
 * is actually a *claim* needing an evidence status uses
 * `evidenceClaimSchema` instead.
 */
const knownOrUnknownString = z.string().min(1);

/**
 * A single existing solution extracted from research sources, plus its
 * comparison-against-the-problem fields (kept on the same object rather
 * than nested — "solution comparison" is just this solution's data
 * examined from the pain/stakeholder-coverage angle, not a separate
 * entity). Every claim-bearing field is an `EvidenceClaim` so
 * VERIFIED/INFERENCE/ASSUMPTION stays explicit throughout — one source
 * saying "Company X provides a platform for Y" supports the *existence*
 * of that platform, nothing about its scale, profitability, or market
 * position, which is exactly what forcing every claim through
 * `evidenceClaimSchema` (never a bare boolean or bare string assertion)
 * is here to prevent.
 */
export const existingSolutionSchema = z.object({
  localId: z.string().min(1),
  name: z.string().min(1),
  organization: knownOrUnknownString,
  country: knownOrUnknownString,
  /** A specific claimed year, or "UNKNOWN" — never invented from memory. */
  yearIfVerified: knownOrUnknownString,
  solutionType: solutionTypeSchema,
  targetUsers: z.array(z.string().min(1)).default([]),
  /** Names/localIds of Phase 02 stakeholders this solution plausibly serves, where a genuine match exists. */
  targetStakeholders: z.array(z.string().min(1)).default([]),
  problemAddressed: evidenceClaimSchema,
  painAddressed: z.array(evidenceClaimSchema).default([]),
  howItWorks: evidenceClaimSchema,
  technology: z.array(z.string().min(1)).default([]),
  deploymentStatus: deploymentStatusSchema,
  businessModelIfKnown: knownOrUnknownString,
  strengths: z.array(evidenceClaimSchema).default([]),
  limitations: z.array(evidenceClaimSchema).default([]),
  evidenceClaims: z.array(evidenceClaimSchema).default([]),
  /** Which normalized sources (by sourceLocalId) this solution is traced to — every solution must cite at least one; a solution with none is a hallucination, not a finding. */
  sourceIds: z.array(z.string().min(1)).min(1),
  confidence: qualitativeLevelSchema,

  // --- Comparison-angle fields ---
  stakeholderCoverage: z.array(z.string().min(1)).default([]),
  painCoverage: z.array(z.string().min(1)).default([]),
  accessibility: evidenceClaimSchema.optional(),
  costInformation: knownOrUnknownString,
  scalability: evidenceClaimSchema.optional(),
  geographicCoverage: knownOrUnknownString,
  integration: evidenceClaimSchema.optional(),
  /** Confidence specifically in the comparison claims above, which may be weaker than the solution's own existence confidence. */
  evidenceConfidence: qualitativeLevelSchema,
});

export type ExistingSolution = z.infer<typeof existingSolutionSchema>;

export const solutionExtractorOutputSchema = z.object({
  /**
   * Deliberately not `.min(1)` — zero credible existing solutions is a
   * legitimate, honest finding (a genuine green field), not a failure
   * this schema should make harder to express.
   */
  solutions: z.array(existingSolutionSchema).default([]),
  /** Short, contextual PRISM-voice remark reacting to the actual research findings — never a hard-coded line. */
  consultantMessage: z.string().min(1),
});

export type SolutionExtractorOutput = z.infer<typeof solutionExtractorOutputSchema>;
