import { z } from "zod";

import { validationAgentOutputSchema } from "@/lib/agents/validation-agent/schema";

/**
 * The composer's deterministic verdict — never the Validation Agent's
 * own `buildRecommendation` verbatim. See
 * `src/lib/phases/poc-validation/index.ts` for the mechanical rules
 * that derive it from Phase 07/08's actual state, which the model
 * cannot override.
 */
export const finalValidationDecisionSchema = z.enum([
  "VALIDATED_TO_PROCEED",
  "PROCEED_WITH_CHANGES",
  "VALIDATE_BEFORE_BUILD",
  "DO_NOT_BUILD",
  "INSUFFICIENT_EVIDENCE",
]);
export type FinalValidationDecision = z.infer<typeof finalValidationDecisionSchema>;

/**
 * Phase 09's persisted output: the Validation Agent's own output, plus
 * what the composer computes — `evidenceSummary`'s numeric counts and
 * `finalValidationDecision` (with its own reasoning trail) — the same
 * split every prior phase's composer establishes between agent-supplied
 * narrative and composer-computed, mechanically-derived fields.
 */
export const pocValidationAnalysisSchema = validationAgentOutputSchema
  .omit({ evidenceSummary: true })
  .extend({
    evidenceSummary: z.object({
      totalSourcesReferenced: z.number().int().nonnegative(),
      verifiedClaimsCount: z.number().int().nonnegative(),
      contradictedClaimsCount: z.number().int().nonnegative(),
      narrative: z.string().min(1),
    }),
    finalValidationDecision: finalValidationDecisionSchema,
    finalValidationDecisionReasoning: z.array(z.string().min(1)).min(1),
  });
export type PocValidationAnalysis = z.infer<typeof pocValidationAnalysisSchema>;
