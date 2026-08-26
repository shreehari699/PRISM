import { z } from "zod";

import {
  customerDistinctionSchema,
  painPointSchema,
  painRankingSchema,
  realityCheckSchema,
} from "@/lib/agents/pain-analyst/schema";
import { draftStakeholderSchema } from "@/lib/agents/stakeholder-analyst/schema";
import { evidenceClaimSchema } from "@/lib/prism/evidence";

/**
 * The phase-level stakeholder shape: everything the Stakeholder Analyst
 * produced, plus `painPointIds` — which the phase composer computes
 * deterministically from the Pain Analyst's output rather than trusting
 * either model call to keep both sides of the relationship in sync.
 */
export const stakeholderSchema = draftStakeholderSchema.extend({
  painPointIds: z.array(z.string()).default([]),
});

export type Stakeholder = z.infer<typeof stakeholderSchema>;

/**
 * Final, merged Phase 02 output — what gets persisted to
 * `analysis_phases.output_data` and validated before it's ever trusted
 * as this phase's result. Structurally, everything besides `stakeholders`
 * is exactly the Pain Analyst's output shape (see
 * src/lib/agents/pain-analyst/schema.ts) — the composer only adds the
 * cross-referenced stakeholder list on top.
 */
export const stakeholderPainAnalysisSchema = z.object({
  stakeholders: z.array(stakeholderSchema).min(1),
  painPoints: z.array(painPointSchema).min(1),
  primaryPain: painRankingSchema,
  secondaryPains: z.array(painRankingSchema).default([]),
  downstreamConsequences: z.array(evidenceClaimSchema).default([]),
  customerDistinction: customerDistinctionSchema,
  validationQuestions: z.array(z.string().min(1)).min(1),
  realityCheck: realityCheckSchema,
  consultantMessage: z.string().min(1),
});

export type StakeholderPainAnalysis = z.infer<
  typeof stakeholderPainAnalysisSchema
>;
