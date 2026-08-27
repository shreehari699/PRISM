import { z } from "zod";

import { qualitativeLevelSchema } from "@/lib/prism/scoring";

/**
 * The dossier's own final-decision vocabulary. Deliberately distinct
 * from Phase 09's `finalValidationDecisionSchema` (VALIDATED_TO_PROCEED/
 * PROCEED_WITH_CHANGES/...): the dossier speaks in the plain BUILD/
 * BUILD_WITH_CHANGES language a user reads, and adds
 * `RESEARCH_BEFORE_BUILD` for RESEARCH-mode projects. This is the
 * agent's own honest opinion — the composer's deterministic decision
 * engine (`src/lib/phases/intelligence-dossier/index.ts`) floors it
 * against Phase 04–09's actual state and can never let it be more
 * optimistic than the evidence allows.
 */
export const dossierDecisionSchema = z.enum([
  "BUILD",
  "BUILD_WITH_CHANGES",
  "VALIDATE_BEFORE_BUILD",
  "RESEARCH_BEFORE_BUILD",
  "DO_NOT_BUILD",
  "INSUFFICIENT_EVIDENCE",
]);
export type DossierDecision = z.infer<typeof dossierDecisionSchema>;

export const importanceSchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export type Importance = z.infer<typeof importanceSchema>;

export const sectionIdSchema = z.enum([
  "EXECUTIVE_SUMMARY",
  "PROBLEM",
  "STAKEHOLDERS",
  "PAIN",
  "EXISTING_SOLUTIONS",
  "GAPS",
  "OPPORTUNITY",
  "MARKET",
  "FEASIBILITY",
  "SOLUTION",
  "ARCHITECTURE",
  "POC",
  "IMPLEMENTATION",
  "RED_TEAM",
  "JURY",
  "ASSUMPTIONS",
  "VALIDATION",
  "FINAL_VERDICT",
  "NEXT_ACTIONS",
  "EVIDENCE",
]);
export type SectionId = z.infer<typeof sectionIdSchema>;

const sectionSummarySchema = z.object({
  summary: z.string().min(1),
  importance: importanceSchema,
});

/**
 * One entry per `SectionId`, keyed in camelCase — a fixed,
 * always-fully-present 20-key object (the same non-sparse discipline as
 * every prior phase's checklist-shaped fields) rather than an array the
 * model could under- or over-populate. The composer builds the final
 * `sectionManifest` array from this, filling in the fixed `sectionId`/
 * `title` itself and capping how many may be marked CRITICAL.
 */
export const sectionSummariesSchema = z.object({
  executiveSummary: sectionSummarySchema,
  problem: sectionSummarySchema,
  stakeholders: sectionSummarySchema,
  pain: sectionSummarySchema,
  existingSolutions: sectionSummarySchema,
  gaps: sectionSummarySchema,
  opportunity: sectionSummarySchema,
  market: sectionSummarySchema,
  feasibility: sectionSummarySchema,
  solution: sectionSummarySchema,
  architecture: sectionSummarySchema,
  poc: sectionSummarySchema,
  implementation: sectionSummarySchema,
  redTeam: sectionSummarySchema,
  jury: sectionSummarySchema,
  assumptions: sectionSummarySchema,
  validation: sectionSummarySchema,
  finalVerdict: sectionSummarySchema,
  nextActions: sectionSummarySchema,
  evidence: sectionSummarySchema,
});
export type SectionSummaries = z.infer<typeof sectionSummariesSchema>;

const executiveSummarySchema = z.object({
  whatIsTheProblem: z.string().min(1),
  whoHasTheProblem: z.string().min(1),
  whyDoesItMatter: z.string().min(1),
  whatAlreadyExists: z.string().min(1),
  whatIsMissing: z.string().min(1),
  whatOpportunityExists: z.string().min(1),
  canItBeBuilt: z.string().min(1),
  whatShouldBeBuilt: z.string().min(1),
  whatIsTheBiggestRisk: z.string().min(1),
  whatShouldTheTeamDoNext: z.string().min(1),
});
export type ExecutiveSummaryNarrative = z.infer<typeof executiveSummarySchema>;

/**
 * Which Phase 09 red-team point/assumption/failure mode the dossier
 * points to for each "biggest risk" slot — never re-described from
 * scratch. The composer resolves each id against the real Phase 09
 * output and rejects an unknown one. The three "biggest X risk" slots
 * are nullable since not every project surfaces a claim in every
 * domain.
 */
export const redTeamSelectionSchema = z.object({
  strongestAttackPointId: z.string().min(1),
  weakestAssumptionId: z.string().min(1),
  biggestTechnicalRiskValidationId: z.string().min(1).nullable(),
  biggestMarketRiskValidationId: z.string().min(1).nullable(),
  biggestAdoptionRiskValidationId: z.string().min(1).nullable(),
  mostLikelyFailureId: z.string().min(1),
  mitigation: z.string().min(1),
});
export type RedTeamSelection = z.infer<typeof redTeamSelectionSchema>;

const decisionTraceStageSchema = z.object({
  finding: z.string().min(1),
  /** Source ids / phase-local claim ids this stage's finding rests on — validated by the composer. */
  criticalEvidence: z.array(z.string().min(1)).default([]),
});

/**
 * A fixed eight-stage object (Problem → Pain → Gap → Opportunity →
 * Market → Feasibility → Solution → Validation), never a model-ordered
 * array — the trace order is the architecture, not a model choice. The
 * model supplies only the narrative `finding` and which evidence it
 * rests on; the composer attaches each stage's real upstream confidence
 * level itself (never trusted from the model).
 */
export const decisionTraceInputSchema = z.object({
  problem: decisionTraceStageSchema,
  pain: decisionTraceStageSchema,
  gap: decisionTraceStageSchema,
  opportunity: decisionTraceStageSchema,
  market: decisionTraceStageSchema,
  feasibility: decisionTraceStageSchema,
  solution: decisionTraceStageSchema,
  validation: decisionTraceStageSchema,
});
export type DecisionTraceInput = z.infer<typeof decisionTraceInputSchema>;

export const nextActionStepSchema = z.object({
  step: z.number().int().min(1),
  action: z.string().min(1),
  reason: z.string().min(1),
  expectedOutput: z.string().min(1),
  priority: qualitativeLevelSchema,
});
export type NextActionStep = z.infer<typeof nextActionStepSchema>;

/**
 * The Report Generator's raw output. Deliberately narrow: it supplies
 * narrative synthesis and, where a section needs one, a *selection* of
 * a real upstream id — never a fact the composer could otherwise copy
 * directly from Phases 01–09's own structured output. See
 * `src/lib/phases/intelligence-dossier/schema.ts` for everything the
 * composer assembles on top of this.
 */
export const reportGeneratorOutputSchema = z.object({
  executiveSummary: executiveSummarySchema,
  problemContext: z.string().min(1),
  problemImportantUnknowns: z.array(z.string().min(1)).default([]),
  stakeholderNarrative: z.string().min(1),
  /** Phase 02 `painPoint.localId`s the dossier should feature — a subset, not every pain. */
  importantPainLocalIds: z.array(z.string().min(1)).min(1),
  painNarrative: z.string().min(1),
  /** Phase 03 `solution.localId`s the dossier should feature — a subset, not every solution. */
  importantSolutionLocalIds: z.array(z.string().min(1)).default([]),
  solutionLandscapeNarrative: z.string().min(1),
  /** A real Phase 04 gap id — must be in `confirmedGaps` or `candidateGaps`, never `noGapFindings`. Null only when no gap exists at all. */
  mostImportantGapId: z.string().min(1).nullable(),
  gapNarrative: z.string().min(1),
  opportunityNarrative: z.string().min(1),
  innovationDirectionSummary: z.string().min(1),
  aiJustificationSummary: z.string().min(1),
  marketNarrative: z.string().min(1),
  feasibilityNarrative: z.string().min(1),
  solutionArchitectureSummary: z.string().min(1).nullable(),
  solutionDataFlowSummary: z.string().min(1).nullable(),
  pocNarrative: z.string().min(1).nullable(),
  implementationNarrative: z.string().min(1).nullable(),
  redTeamSelection: redTeamSelectionSchema,
  /** Phase 09 `juryQuestion.questionId`s — the hardest questions, a subset. */
  topJuryQuestionIds: z.array(z.string().min(1)).min(1),
  jurySummaryNarrative: z.string().min(1),
  validationPlanNarrative: z.string().min(1),
  nextActionPlan: z.array(nextActionStepSchema).min(1),
  decisionTrace: decisionTraceInputSchema,
  majorReasons: z.array(z.string().min(1)).min(1),
  buildRecommendation: dossierDecisionSchema,
  buildRecommendationReasoning: z.string().min(1),
  sectionSummaries: sectionSummariesSchema,
  finalConsultantMessage: z.string().min(1),
});
export type ReportGeneratorOutput = z.infer<typeof reportGeneratorOutputSchema>;
