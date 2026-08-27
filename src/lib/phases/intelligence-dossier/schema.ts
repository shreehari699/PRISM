import { z } from "zod";

import { existingSolutionSchema } from "@/lib/agents/existing-solution-agent/schema";
import {
  aiFeasibilitySchema,
  costFeasibilitySchema,
  criticalBlockerSchema,
  dataFeasibilitySchema,
  feasibilityScalabilitySchema,
  hardwareFeasibilitySchema,
  overallFeasibilitySchema,
  regulatorySafetySchema,
  securityPrivacySchema,
  softwareFeasibilitySchema,
  teamFeasibilitySchema,
  technicalFeasibilitySchema as technicalDimensionsSchema,
  timeFeasibilitySchema,
} from "@/lib/agents/feasibility-agent/schema";
import { gapCandidateSchema, gapRealityCheckSchema } from "@/lib/agents/gap-agent/schema";
import { opportunityRealityCheckSchema } from "@/lib/agents/innovation-agent/schema";
import { investmentRealityCheckSchema } from "@/lib/agents/investment-agent/schema";
import {
  businessModelEntrySchema,
  competitiveLandscapeSchema,
  customerModelSchema,
  marketRealityCheckSchema,
  marketSegmentEntrySchema,
  marketSizeAnalysisSchema,
} from "@/lib/agents/market-agent/schema";
import {
  dossierDecisionSchema,
  importanceSchema,
  nextActionStepSchema,
  sectionIdSchema,
} from "@/lib/agents/report-generator/schema";
import {
  featureItemSchema,
  implementationStepSchema,
  modeSolutionPlanSchema,
  solutionTypeSchema,
} from "@/lib/agents/solution-consultant/schema";
import {
  assumptionSchema,
  juryPerspectiveReviewSchema,
  validationConfidenceSchema,
  validationExperimentSchema,
} from "@/lib/agents/validation-agent/schema";
import { opportunitySchema } from "@/lib/phases/opportunity-innovation/schema";
import { richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { marketNumberSchema } from "@/lib/prism/market";
import { qualitativeLevelSchema } from "@/lib/prism/scoring";

export const sectionStatusSchema = z.enum(["COMPLETE", "PARTIAL", "INSUFFICIENT_EVIDENCE"]);
export type SectionStatus = z.infer<typeof sectionStatusSchema>;

export const problemBriefSchema = z.object({
  problem: z.string().min(1),
  context: z.string().min(1),
  affectedUsers: z.array(z.string().min(1)).default([]),
  corePain: z.string().min(1),
  problemClarity: z.boolean(),
  evidenceStrength: qualitativeLevelSchema,
  importantUnknowns: z.array(z.string().min(1)).default([]),
});
export type ProblemBrief = z.infer<typeof problemBriefSchema>;

/**
 * Every list here is filtered directly from Phase 02's real `category`
 * (PRIMARY/SECONDARY/TERTIARY) and `roles` (USER/BUYER/BENEFICIARY/
 * DECISION_MAKER) fields — never a role the model invents. A
 * stakeholder can appear in more than one list (a farmer can be both a
 * PRIMARY stakeholder and a USER).
 */
export const stakeholderBriefSchema = z.object({
  primaryStakeholders: z.array(z.string().min(1)).default([]),
  secondaryStakeholders: z.array(z.string().min(1)).default([]),
  tertiaryStakeholders: z.array(z.string().min(1)).default([]),
  users: z.array(z.string().min(1)).default([]),
  buyers: z.array(z.string().min(1)).default([]),
  beneficiaries: z.array(z.string().min(1)).default([]),
  decisionMakers: z.array(z.string().min(1)).default([]),
  narrative: z.string().min(1),
});
export type StakeholderBrief = z.infer<typeof stakeholderBriefSchema>;

const painBriefEntrySchema = z.object({
  painLocalId: z.string().min(1),
  pain: z.string().min(1),
  affectedStakeholder: z.string().min(1),
  severity: z.number(),
  evidence: z.string().min(1),
  confidence: qualitativeLevelSchema,
});
export type PainBriefEntry = z.infer<typeof painBriefEntrySchema>;

export const painBriefSchema = z.object({
  pains: z.array(painBriefEntrySchema).default([]),
  narrative: z.string().min(1),
});
export type PainBrief = z.infer<typeof painBriefSchema>;

export const solutionLandscapeSchema = z.object({
  solutions: z.array(existingSolutionSchema).default([]),
  narrative: z.string().min(1),
});
export type SolutionLandscape = z.infer<typeof solutionLandscapeSchema>;

export const gapBriefSchema = z.object({
  confirmedGaps: z.array(z.string()).default([]),
  candidateGaps: z.array(z.string()).default([]),
  unverifiedGaps: z.array(z.string()).default([]),
  noGapFindings: z.array(z.string()).default([]),
  mostImportantGap: gapCandidateSchema.nullable(),
  gapRealityCheck: gapRealityCheckSchema,
  narrative: z.string().min(1),
});
export type GapBrief = z.infer<typeof gapBriefSchema>;

export const opportunityBriefSchema = z.object({
  leadingOpportunity: opportunitySchema.nullable(),
  otherOpportunities: z.array(opportunitySchema).default([]),
  opportunityRealityCheck: opportunityRealityCheckSchema,
  innovationDirectionSummary: z.string().min(1),
  differentiation: richEvidenceClaimSchema.nullable(),
  aiJustificationSummary: z.string().min(1),
  narrative: z.string().min(1),
});
export type OpportunityBrief = z.infer<typeof opportunityBriefSchema>;

export const marketBriefSchema = z.object({
  customerModel: customerModelSchema.nullable(),
  marketSegments: z.array(marketSegmentEntrySchema).default([]),
  competitiveContext: competitiveLandscapeSchema,
  businessModels: z.array(businessModelEntrySchema).default([]),
  tamAnalysis: marketSizeAnalysisSchema,
  samAnalysis: marketSizeAnalysisSchema,
  somAnalysis: marketSizeAnalysisSchema,
  marketRealityCheck: marketRealityCheckSchema,
  investmentRealityCheck: investmentRealityCheckSchema,
  narrative: z.string().min(1),
});
export type MarketBrief = z.infer<typeof marketBriefSchema>;

export const feasibilityBriefSchema = z.object({
  overallFeasibility: overallFeasibilitySchema,
  technical: technicalDimensionsSchema,
  data: dataFeasibilitySchema,
  ai: aiFeasibilitySchema.nullable(),
  hardware: hardwareFeasibilitySchema.nullable(),
  software: softwareFeasibilitySchema,
  team: teamFeasibilitySchema,
  time: timeFeasibilitySchema,
  cost: costFeasibilitySchema,
  regulatory: regulatorySafetySchema,
  security: securityPrivacySchema,
  scalability: feasibilityScalabilitySchema,
  criticalBlockers: z.array(criticalBlockerSchema).default([]),
  narrative: z.string().min(1),
});
export type FeasibilityBrief = z.infer<typeof feasibilityBriefSchema>;

export const recommendedSolutionSchema = z
  .object({
    solutionName: z.string().min(1),
    tagline: z.string().min(1),
    executiveDescription: z.string().min(1),
    whyThisSolution: z.string().min(1),
    primaryUsers: z.array(z.string().min(1)).default([]),
    coreValueProposition: z.string().min(1),
    validatedGapId: z.string().min(1),
    opportunityId: z.string().min(1),
    differentiation: richEvidenceClaimSchema,
    solutionType: solutionTypeSchema,
    aiRoleClassification: z.string().min(1),
    technologyApproach: z.string().min(1),
    architectureSummary: z.string().min(1),
    dataFlowSummary: z.string().min(1),
    coreFeatures: z.array(featureItemSchema).default([]),
    mustBuild: z.array(featureItemSchema).default([]),
    shouldBuild: z.array(featureItemSchema).default([]),
    future: z.array(featureItemSchema).default([]),
    doNotBuild: z.array(featureItemSchema).default([]),
  })
  .nullable();
export type RecommendedSolution = z.infer<typeof recommendedSolutionSchema>;

export const pocPlanSchema = z
  .object({
    objective: z.string().min(1),
    scope: z.string().min(1),
    input: z.string().min(1),
    process: z.string().min(1),
    output: z.string().min(1),
    successCriteria: z.array(z.string().min(1)).default([]),
    failureCriteria: z.array(z.string().min(1)).default([]),
    estimatedEffort: marketNumberSchema,
  })
  .nullable();
export type PocPlan = z.infer<typeof pocPlanSchema>;

export const implementationPlanSchema = z
  .object({
    roadmapSteps: z.array(implementationStepSchema).default([]),
    modePlan: modeSolutionPlanSchema,
    narrative: z.string().min(1),
  })
  .nullable();
export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;

const resolvedRedTeamItemSchema = z
  .object({ id: z.string().min(1), text: z.string().min(1) })
  .nullable();

export const redTeamSummarySchema = z.object({
  strongestAttack: resolvedRedTeamItemSchema,
  weakestAssumption: resolvedRedTeamItemSchema,
  biggestTechnicalRisk: resolvedRedTeamItemSchema,
  biggestMarketRisk: resolvedRedTeamItemSchema,
  biggestAdoptionRisk: resolvedRedTeamItemSchema,
  mostLikelyFailure: resolvedRedTeamItemSchema,
  mitigation: z.string().min(1),
});
export type RedTeamSummary = z.infer<typeof redTeamSummarySchema>;

const topJuryQuestionSchema = z.object({
  question: z.string().min(1),
  bestAnswer: z.string().min(1),
  answerStatus: z.enum(["STRONG", "DEFENSIBLE", "WEAK", "UNKNOWN"]),
});

export const jurySummarySchema = z.object({
  technicalJudge: juryPerspectiveReviewSchema,
  domainJudge: juryPerspectiveReviewSchema,
  businessJudge: juryPerspectiveReviewSchema,
  impactJudge: juryPerspectiveReviewSchema,
  productJudge: juryPerspectiveReviewSchema,
  topJuryQuestions: z.array(topJuryQuestionSchema).default([]),
});
export type JurySummary = z.infer<typeof jurySummarySchema>;

/**
 * `criticalAssumptions` holds exactly the one assumption Phase 09
 * selected as `single_most_dangerous_assumption` — kept as an array
 * for structural symmetry with the other three buckets, never a
 * second, independently-invented "critical" list.
 * `PARTIALLY_SUPPORTED` assumptions are grouped into `supported`
 * (some real support exists), everything else follows its literal
 * Phase 09 status.
 */
export const assumptionSummarySchema = z.object({
  criticalAssumptions: z.array(assumptionSchema).min(1).max(1),
  supportedAssumptions: z.array(assumptionSchema).default([]),
  unsupportedAssumptions: z.array(assumptionSchema).default([]),
  unknownAssumptions: z.array(assumptionSchema).default([]),
});
export type AssumptionSummary = z.infer<typeof assumptionSummarySchema>;

export const dossierValidationPlanSchema = z.object({
  experiments: z.array(validationExperimentSchema).default([]),
  narrative: z.string().min(1),
});
export type DossierValidationPlan = z.infer<typeof dossierValidationPlanSchema>;

export const finalVerdictSchema = z.object({
  decision: dossierDecisionSchema,
  confidence: validationConfidenceSchema,
  reason: z.string().min(1),
  evidenceStrength: validationConfidenceSchema,
  majorReasons: z.array(z.string().min(1)).min(1),
  criticalBlockers: z.array(criticalBlockerSchema).default([]),
  nextAction: z.string().min(1),
});
export type FinalVerdict = z.infer<typeof finalVerdictSchema>;

const decisionTraceStageOutputSchema = z.object({
  phase: z.string().min(1),
  finding: z.string().min(1),
  confidence: z.string().min(1),
  criticalEvidence: z.array(z.string().min(1)).default([]),
});

export const decisionTraceSchema = z.object({
  problem: decisionTraceStageOutputSchema,
  pain: decisionTraceStageOutputSchema,
  gap: decisionTraceStageOutputSchema,
  opportunity: decisionTraceStageOutputSchema,
  market: decisionTraceStageOutputSchema,
  feasibility: decisionTraceStageOutputSchema,
  solution: decisionTraceStageOutputSchema,
  validation: decisionTraceStageOutputSchema,
});
export type DecisionTrace = z.infer<typeof decisionTraceSchema>;

export const dossierEvidenceSummarySchema = z.object({
  verifiedClaims: z.number().int().nonnegative(),
  inferences: z.number().int().nonnegative(),
  assumptions: z.number().int().nonnegative(),
  unknowns: z.number().int().nonnegative(),
  contradictions: z.number().int().nonnegative(),
  sourcesUsed: z.number().int().nonnegative(),
});
export type DossierEvidenceSummary = z.infer<typeof dossierEvidenceSummarySchema>;

export const dossierSectionSchema = z.object({
  sectionId: sectionIdSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  importance: importanceSchema,
  status: sectionStatusSchema,
});
export type DossierSection = z.infer<typeof dossierSectionSchema>;

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

/**
 * Phase 10's persisted output — the PRISM Intelligence Dossier. Every
 * factual field (stakeholder lists, gap/opportunity ids, market
 * numbers, feasibility dimensions, jury panel, assumption register) is
 * copied or filtered by the composer directly from Phases 01-09's own
 * structured output, never re-authored by the model. The model
 * (`src/lib/agents/report-generator/`) supplies only narrative
 * synthesis and, where a section needs one, a validated selection of a
 * real upstream id. `finalDecision` is computed by the composer's
 * deterministic decision engine and can never be more optimistic than
 * Phases 04-09's own state allows.
 */
export const intelligenceDossierAnalysisSchema = z.object({
  executiveSummary: executiveSummarySchema,
  problemBrief: problemBriefSchema,
  stakeholderBrief: stakeholderBriefSchema,
  painBrief: painBriefSchema,
  solutionLandscape: solutionLandscapeSchema,
  gapBrief: gapBriefSchema,
  opportunityBrief: opportunityBriefSchema,
  marketBrief: marketBriefSchema,
  feasibilityBrief: feasibilityBriefSchema,
  recommendedSolution: recommendedSolutionSchema,
  pocPlan: pocPlanSchema,
  implementationPlan: implementationPlanSchema,
  redTeamSummary: redTeamSummarySchema,
  jurySummary: jurySummarySchema,
  assumptionSummary: assumptionSummarySchema,
  validationPlan: dossierValidationPlanSchema,
  finalVerdict: finalVerdictSchema,
  nextActionPlan: z.array(nextActionStepSchema).min(1),
  decisionTrace: decisionTraceSchema,
  evidenceSummary: dossierEvidenceSummarySchema,
  overallConfidence: validationConfidenceSchema,
  sectionManifest: z.array(dossierSectionSchema).length(20),
  finalConsultantMessage: z.string().min(1),
});
export type IntelligenceDossierAnalysis = z.infer<typeof intelligenceDossierAnalysisSchema>;
