import { z } from "zod";

import { evidenceClaimSchema } from "@/lib/prism/evidence";
import { qualitativeLevelSchema } from "@/lib/prism/scoring";

/** Where a stakeholder sits relative to the problem — not a ranking of importance. */
export const stakeholderTierSchema = z.enum(["PRIMARY", "SECONDARY", "TERTIARY"]);
export type StakeholderTier = z.infer<typeof stakeholderTierSchema>;

/**
 * A stakeholder may hold more than one of these — a field officer using
 * a government system is USER and IMPLEMENTER at once, for instance.
 */
export const stakeholderRoleSchema = z.enum([
  "USER",
  "CONSUMER",
  "BUYER",
  "BENEFICIARY",
  "OPERATOR",
  "DECISION_MAKER",
  "INFLUENCER",
  "REGULATOR",
  "IMPLEMENTER",
  "AFFECTED_PARTY",
]);
export type StakeholderRole = z.infer<typeof stakeholderRoleSchema>;

/**
 * Distinct from `qualitativeLevelSchema` (low/medium/high): a
 * stakeholder can have literally NO purchasing/decision authority (a
 * beneficiary is not automatically "low" on this axis, they're often
 * "none" — the buyer-vs-beneficiary distinction the phase must draw
 * depends on this axis actually being able to say zero).
 */
export const decisionPowerSchema = z.enum(["none", "low", "medium", "high"]);
export type DecisionPower = z.infer<typeof decisionPowerSchema>;

/**
 * What the Stakeholder Analyst produces on its own — before pain points
 * exist. The phase composer (src/lib/phases/stakeholder-pain) adds
 * `painPointIds` afterward, computed deterministically from the Pain
 * Analyst's output rather than trusted from either model call, so the
 * two lists can never disagree with each other.
 */
export const draftStakeholderSchema = z.object({
  /** A short slug this response uses to cross-reference this stakeholder from pain points — not a database id. */
  localId: z.string().min(1),
  name: z.string().min(1),
  category: stakeholderTierSchema,
  roles: z.array(stakeholderRoleSchema).min(1),
  /** How and why this stakeholder connects to the problem — itself evidence-tagged, not asserted as fact. */
  relationshipToProblem: evidenceClaimSchema,
  context: z.string().min(1),
  needs: z.array(z.string().min(1)).default([]),
  currentWorkaround: evidenceClaimSchema.optional(),
  decisionPower: decisionPowerSchema,
  influence: qualitativeLevelSchema,
  urgency: qualitativeLevelSchema,
  impact: qualitativeLevelSchema,
  evidenceClaims: z.array(evidenceClaimSchema).default([]),
  confidence: qualitativeLevelSchema,
});

export type DraftStakeholder = z.infer<typeof draftStakeholderSchema>;

export const stakeholderAnalystOutputSchema = z.object({
  stakeholders: z.array(draftStakeholderSchema).min(1),
});

export type StakeholderAnalystOutput = z.infer<
  typeof stakeholderAnalystOutputSchema
>;
