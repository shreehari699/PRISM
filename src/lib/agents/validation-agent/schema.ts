import { z } from "zod";

import { marketNumberSchema } from "@/lib/prism/market";
import { qualitativeLevelSchema, scoreBasisSchema, scoreSchema } from "@/lib/prism/scoring";

/**
 * The fourteen angles Phase 09 can attack a project from. Not every
 * project surfaces a finding in every domain — `validationClaims` only
 * requires at least one entry, never all fourteen.
 */
export const validationDomainSchema = z.enum([
  "PROBLEM_VALIDATION",
  "PAIN_VALIDATION",
  "STAKEHOLDER_VALIDATION",
  "SOLUTION_VALIDATION",
  "GAP_VALIDATION",
  "DIFFERENTIATION_VALIDATION",
  "MARKET_VALIDATION",
  "TECHNICAL_VALIDATION",
  "DATA_VALIDATION",
  "IMPLEMENTATION_VALIDATION",
  "BUSINESS_VALIDATION",
  "ADOPTION_VALIDATION",
  "SAFETY_VALIDATION",
  "SCALABILITY_VALIDATION",
]);
export type ValidationDomain = z.infer<typeof validationDomainSchema>;

/**
 * Deliberately wider than the shared `evidenceStatusSchema`
 * (VERIFIED/INFERENCE/ASSUMPTION/RECOMMENDATION/UNKNOWN): a validation
 * claim is actively testing a prior phase's assertion against evidence,
 * so it needs two statuses no other phase's claims do —
 * `PARTIALLY_SUPPORTED` (some but not all of the claim holds up) and
 * `CONTRADICTED` (the evidence actively disagrees) — while
 * `RECOMMENDATION` doesn't apply here, since a validation claim is
 * always either checking a fact or admitting it can't.
 */
export const validationEvidenceStatusSchema = z.enum([
  "VERIFIED",
  "PARTIALLY_SUPPORTED",
  "INFERENCE",
  "ASSUMPTION",
  "UNKNOWN",
  "CONTRADICTED",
]);
export type ValidationEvidenceStatus = z.infer<typeof validationEvidenceStatusSchema>;

/**
 * One adversarial finding. `sourceIds` grounds `evidence` in Phase 06's
 * combined source list exactly like every other phase's claims — a
 * `VERIFIED` or `PARTIALLY_SUPPORTED` finding must cite at least one
 * real source, never assert itself into credibility.
 */
export const validationClaimSchema = z
  .object({
    validationId: z.string().min(1),
    domain: validationDomainSchema,
    claim: z.string().min(1),
    question: z.string().min(1),
    evidence: z.string().min(1),
    evidenceStatus: validationEvidenceStatusSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
    finding: z.string().min(1),
    confidence: qualitativeLevelSchema,
    severity: qualitativeLevelSchema,
    recommendedAction: z.string().min(1),
  })
  .superRefine((c, ctx) => {
    if (
      (c.evidenceStatus === "VERIFIED" || c.evidenceStatus === "PARTIALLY_SUPPORTED") &&
      c.sourceIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: `A ${c.evidenceStatus} validation claim must cite at least one source id.`,
        path: ["sourceIds"],
      });
    }
  });
export type ValidationClaim = z.infer<typeof validationClaimSchema>;

export const assumptionCategorySchema = z.enum([
  "USER",
  "MARKET",
  "TECHNICAL",
  "DATA",
  "BUSINESS",
  "OPERATIONAL",
  "REGULATORY",
  "TEAM",
  "TIME",
  "COST",
  "ADOPTION",
  "OTHER",
]);
export type AssumptionCategory = z.infer<typeof assumptionCategorySchema>;

export const assumptionStatusSchema = z.enum([
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "UNSUPPORTED",
  "UNKNOWN",
  "CONTRADICTED",
]);
export type AssumptionStatus = z.infer<typeof assumptionStatusSchema>;

export const assumptionSchema = z.object({
  assumptionId: z.string().min(1),
  assumption: z.string().min(1),
  category: assumptionCategorySchema,
  whyItMatters: z.string().min(1),
  dependency: z.string().min(1),
  confidence: qualitativeLevelSchema,
  validationMethod: z.string().min(1),
  failureImpact: z.string().min(1),
  status: assumptionStatusSchema,
});
export type Assumption = z.infer<typeof assumptionSchema>;

/**
 * A red-team point is either grounded in real evidence already collected
 * (`EVIDENCE_BACKED`, and must cite a source) or a genuine hypothetical
 * the red team raises without inventing a fact to support it
 * (`HYPOTHETICAL`) — the spec's own "separate evidence-backed criticism
 * from hypothetical criticism."
 */
export const redTeamPointCategorySchema = z.enum(["EVIDENCE_BACKED", "HYPOTHETICAL"]);
export type RedTeamPointCategory = z.infer<typeof redTeamPointCategorySchema>;

export const redTeamPointSchema = z
  .object({
    pointId: z.string().min(1),
    argument: z.string().min(1),
    category: redTeamPointCategorySchema,
    targetArea: z.string().min(1),
    severity: qualitativeLevelSchema,
    sourceIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.category === "EVIDENCE_BACKED" && p.sourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "An EVIDENCE_BACKED red-team point must cite at least one source id.",
        path: ["sourceIds"],
      });
    }
  });
export type RedTeamPoint = z.infer<typeof redTeamPointSchema>;

/**
 * `mostFragileAssumptionId` is nullable at the schema level but, when
 * set, must resolve to a real entry in `assumptionRegister` — enforced
 * by the composer, which is the only thing holding the full register.
 */
export const redTeamReviewSchema = z.object({
  points: z.array(redTeamPointSchema).min(1),
  mostFragileAssumptionId: z.string().min(1).nullable(),
  hiddenDependencies: z.array(z.string().min(1)).default([]),
  keyTechnologyFailureImpact: z.string().min(1).nullable(),
  summary: z.string().min(1),
});
export type RedTeamReview = z.infer<typeof redTeamReviewSchema>;

export const juryPerspectiveSchema = z.enum([
  "TECHNICAL_JUDGE",
  "DOMAIN_EXPERT",
  "BUSINESS_JUDGE",
  "IMPACT_JUDGE",
  "PRODUCT_JUDGE",
]);
export type JuryPerspective = z.infer<typeof juryPerspectiveSchema>;

/**
 * `scoreOrAssessment` reuses the shared `Score` model (value + basis +
 * reasoning + confidence) so "scores must never be unexplained" is
 * enforced by the type itself, not a prompt request — `basis` carries
 * exactly the `MODEL_ESTIMATE`-equivalent label (`"ai_estimate"`) the
 * spec asks for, no new vocabulary. The outer `confidence` is the
 * judge's confidence in their overall review, distinct from the
 * embedded score's own confidence in its specific value.
 */
export const juryPerspectiveReviewSchema = z.object({
  strengths: z.array(z.string().min(1)).default([]),
  questions: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  criticalQuestion: z.string().min(1),
  scoreOrAssessment: scoreSchema,
  reasoning: z.string().min(1),
  confidence: qualitativeLevelSchema,
});
export type JuryPerspectiveReview = z.infer<typeof juryPerspectiveReviewSchema>;

/**
 * A fixed, always-fully-present five-key object — the same non-sparse
 * discipline as Phase 07/08's checklist-shaped fields — rather than an
 * array a model could under-populate.
 */
export const juryPanelSchema = z.object({
  technicalJudge: juryPerspectiveReviewSchema,
  domainExpert: juryPerspectiveReviewSchema,
  businessJudge: juryPerspectiveReviewSchema,
  impactJudge: juryPerspectiveReviewSchema,
  productJudge: juryPerspectiveReviewSchema,
});
export type JuryPanel = z.infer<typeof juryPanelSchema>;

export const answerStatusSchema = z.enum(["STRONG", "DEFENSIBLE", "WEAK", "UNKNOWN"]);
export type AnswerStatus = z.infer<typeof answerStatusSchema>;

export const juryQuestionSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1),
  bestAnswer: z.string().min(1),
  evidence: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).default([]),
  confidence: qualitativeLevelSchema,
  answerStatus: answerStatusSchema,
});
export type JuryQuestion = z.infer<typeof juryQuestionSchema>;

/**
 * `likelihood`/`severity` are qualitative, and `basis` pins them to
 * `"ai_estimate"` — exactly the "do not fabricate statistical
 * probabilities, use MODEL_ESTIMATE" instruction, reusing the same
 * `scoreBasisSchema` vocabulary Phase 07's risk register already
 * established rather than inventing a second one.
 */
export const failureModeSchema = z.object({
  failureId: z.string().min(1),
  failure: z.string().min(1),
  cause: z.string().min(1),
  impact: z.string().min(1),
  likelihood: qualitativeLevelSchema,
  severity: qualitativeLevelSchema,
  detection: z.string().min(1),
  mitigation: z.string().min(1),
  fallback: z.string().min(1),
  basis: scoreBasisSchema,
  confidence: qualitativeLevelSchema,
});
export type FailureMode = z.infer<typeof failureModeSchema>;

export const preMortemEntrySchema = z.object({
  failureReason: z.string().min(1),
  earlyWarningSignal: z.string().min(1),
  preventiveAction: z.string().min(1),
  fallback: z.string().min(1),
});
export type PreMortemEntry = z.infer<typeof preMortemEntrySchema>;

export const preMortemSchema = z.object({
  scenario: z.string().min(1),
  entries: z.array(preMortemEntrySchema).min(1),
});
export type PreMortem = z.infer<typeof preMortemSchema>;

/** One point of comparison in the counter-solution analysis. */
export const counterSolutionOptionSchema = z.object({
  description: z.string().min(1),
  addressesCoreProblem: z.string().min(1),
  tradeoffs: z.string().min(1),
});
export type CounterSolutionOption = z.infer<typeof counterSolutionOptionSchema>;

/**
 * The validator is explicitly allowed to conclude the simpler option
 * wins — `conclusion` is not biased toward the recommended solution.
 */
export const counterSolutionConclusionSchema = z.enum([
  "RECOMMENDED_SOLUTION_JUSTIFIED",
  "SIMPLER_SOLUTION_PREFERRED",
  "EXISTING_SOLUTION_SUFFICIENT",
  "MANUAL_WORKAROUND_SUFFICIENT",
]);
export type CounterSolutionConclusion = z.infer<typeof counterSolutionConclusionSchema>;

export const counterSolutionAnalysisSchema = z.object({
  simplestAlternative: z.string().min(1),
  recommended: counterSolutionOptionSchema,
  simpler: counterSolutionOptionSchema,
  existing: counterSolutionOptionSchema,
  manualWorkaround: counterSolutionOptionSchema,
  conclusion: counterSolutionConclusionSchema,
  reasoning: z.string().min(1),
});
export type CounterSolutionAnalysis = z.infer<typeof counterSolutionAnalysisSchema>;

/**
 * The agent's own qualitative recommendation — distinct from the
 * composer-computed `finalValidationDecision` (see
 * `src/lib/phases/poc-validation/index.ts`), which mechanically floors
 * this against Phase 07/08's actual state so the model can never
 * upgrade its way past an unresolved blocker.
 */
export const buildDecisionSchema = z.enum([
  "BUILD",
  "BUILD_WITH_CHANGES",
  "VALIDATE_BEFORE_BUILD",
  "DO_NOT_BUILD",
]);
export type BuildDecision = z.infer<typeof buildDecisionSchema>;

export const validationExperimentSchema = z.object({
  validationId: z.string().min(1),
  hypothesis: z.string().min(1),
  method: z.string().min(1),
  participantsOrData: z.string().min(1),
  measurement: z.string().min(1),
  successCriteria: z.array(z.string().min(1)).min(1),
  failureCriteria: z.array(z.string().min(1)).min(1),
  estimatedEffort: marketNumberSchema,
  priority: qualitativeLevelSchema,
});
export type ValidationExperiment = z.infer<typeof validationExperimentSchema>;

export const pocValidationStatusSchema = z.enum([
  "POC_VALID",
  "POC_INSUFFICIENT",
  "POC_MISALIGNED",
  "NO_POC_DEFINED",
]);
export type PocValidationStatus = z.infer<typeof pocValidationStatusSchema>;

export const pocValidationReviewSchema = z.object({
  status: pocValidationStatusSchema,
  explanation: z.string().min(1),
});
export type PocValidationReview = z.infer<typeof pocValidationReviewSchema>;

/**
 * Booleans, not a score — the phase only judges the *quality* of Phase
 * 08's proposed metrics, it never invents a measured result.
 */
export const successMetricsReviewSchema = z.object({
  wellDefined: z.boolean(),
  measurable: z.boolean(),
  relevant: z.boolean(),
  realistic: z.boolean(),
  explanation: z.string().min(1),
});
export type SuccessMetricsReview = z.infer<typeof successMetricsReviewSchema>;

/**
 * `assumptionId` must resolve to a real entry in the same output's
 * `assumptionRegister` — enforced by the composer. The model is never
 * allowed to invent a new, unregistered "most dangerous" assumption.
 */
export const criticalAssumptionSchema = z.object({
  assumptionId: z.string().min(1),
  reasoning: z.string().min(1),
});
export type CriticalAssumption = z.infer<typeof criticalAssumptionSchema>;

/**
 * Deliberately its own vocabulary — HIGH/MEDIUM/LOW/INSUFFICIENT — not
 * the shared `confidenceLevelSchema` (STRONG/MODERATE/WEAK/
 * INSUFFICIENT_EVIDENCE): this is specifically "should a human trust
 * this adversarial review", asked in the exact words the spec uses.
 */
export const validationConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]);
export type ValidationConfidenceLevel = z.infer<typeof validationConfidenceSchema>;

/**
 * A fixed, always-fully-present six-key object of `Score`s — "never use
 * a bare score" enforced by construction, exactly like `juryPanelSchema`
 * above and Phase 07/08's own checklist-shaped fields.
 */
export const validationScoresSchema = z.object({
  problemConfidence: scoreSchema,
  solutionConfidence: scoreSchema,
  marketConfidence: scoreSchema,
  technicalConfidence: scoreSchema,
  adoptionConfidence: scoreSchema,
  evidenceConfidence: scoreSchema,
});
export type ValidationScores = z.infer<typeof validationScoresSchema>;

/**
 * The Validation Agent's raw output — before the composer computes
 * `evidenceSummary`'s numeric counts and derives `finalValidationDecision`
 * (see `src/lib/phases/poc-validation/schema.ts`).
 */
export const validationAgentOutputSchema = z.object({
  validationClaims: z.array(validationClaimSchema).min(1),
  assumptionRegister: z.array(assumptionSchema).min(1),
  redTeamReview: redTeamReviewSchema,
  jury: juryPanelSchema,
  juryQuestions: z.array(juryQuestionSchema).min(1),
  failureModes: z.array(failureModeSchema).min(1),
  preMortem: preMortemSchema,
  counterSolutionAnalysis: counterSolutionAnalysisSchema,
  buildRecommendation: buildDecisionSchema,
  buildRecommendationReasoning: z.string().min(1),
  validationPlan: z.array(validationExperimentSchema).min(1),
  pocValidation: pocValidationReviewSchema,
  successMetricsReview: successMetricsReviewSchema,
  criticalAssumption: criticalAssumptionSchema,
  validationScores: validationScoresSchema,
  evidenceSummary: z.object({ narrative: z.string().min(1) }),
  confidenceSummary: z.object({
    overallConfidence: validationConfidenceSchema,
    narrative: z.string().min(1),
  }),
  consultantMessage: z.string().min(1),
});
export type ValidationAgentOutput = z.infer<typeof validationAgentOutputSchema>;
