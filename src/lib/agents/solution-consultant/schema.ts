import { z } from "zod";

import { riskCategorySchema } from "@/lib/agents/feasibility-agent/schema";
import { confidenceLevelSchema } from "@/lib/prism/confidence";
import { richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { marketNumberSchema } from "@/lib/prism/market";
import { projectModeSchema } from "@/lib/prism/modes";
import { qualitativeLevelSchema, scoreBasisSchema } from "@/lib/prism/scoring";

// ---------------------------------------------------------------------------
// Solution type & differentiation
// ---------------------------------------------------------------------------

export const solutionTypeSchema = z.enum([
  "SOFTWARE",
  "HARDWARE",
  "AI_SYSTEM",
  "AUTOMATION",
  "SERVICE",
  "INFRASTRUCTURE",
  "DATA_PLATFORM",
  "MARKETPLACE",
  "WORKFLOW",
  "HYBRID",
]);
export type SolutionType = z.infer<typeof solutionTypeSchema>;

/**
 * `overallClaim` is a `richEvidenceClaim`, so the phase composer's
 * anti-overclaim check (no "first"/"only"/"unique"/"world's first"
 * language without `VERIFIED` status) has real evidence discipline to
 * enforce — the same mechanism Phase 05 applies to opportunity
 * differentiation and Phase 06 applies to competitor market position.
 */
export const differentiationSchema = z.object({
  genuinelyDifferent: z.string().min(1),
  incremental: z.string().min(1),
  defensible: z.string().min(1),
  merelyAFeature: z.string().min(1),
  overallClaim: richEvidenceClaimSchema,
});
export type Differentiation = z.infer<typeof differentiationSchema>;

// ---------------------------------------------------------------------------
// Why this solution / alternatives considered
// ---------------------------------------------------------------------------

export const whyThisSolutionSchema = z.object({
  painAddressed: z.string().min(1),
  gapAddressed: z.string().min(1),
  opportunityAddressed: z.string().min(1),
  existingSolutionLimitations: z.string().min(1),
  feasibilityRationale: z.string().min(1),
  marketRationale: z.string().min(1),
  summary: z.string().min(1),
});
export type WhyThisSolution = z.infer<typeof whyThisSolutionSchema>;

/** PRISM must show its work rejecting real alternatives, not just present one solution as inevitable. */
export const alternativeConsideredSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  whyRejected: z.string().min(1),
  tradeoffs: z.string().min(1),
});
export type AlternativeConsidered = z.infer<typeof alternativeConsideredSchema>;

// ---------------------------------------------------------------------------
// AI role & AI architecture
// ---------------------------------------------------------------------------

export const aiRoleClassificationSchema = z.enum([
  "AI_REQUIRED",
  "AI_HIGH_VALUE",
  "AI_OPTIONAL",
  "AI_NOT_REQUIRED",
]);
export type AiRoleClassification = z.infer<typeof aiRoleClassificationSchema>;

export const aiRoleSchema = z.object({
  classification: aiRoleClassificationSchema,
  whyAiIsNeeded: z.string().min(1),
  whatAiDoes: z.string().min(1),
  whatAiDoesNot: z.string().min(1),
  reasoning: z.string().min(1),
});
export type AiRole = z.infer<typeof aiRoleSchema>;

/** Only present when AI genuinely plays a role — the composer checks this against `aiRole.classification`. */
export const aiArchitectureSchema = z.object({
  modelRole: z.string().min(1),
  input: z.string().min(1),
  promptOrTask: z.string().min(1),
  output: z.string().min(1),
  validation: z.string().min(1),
  fallback: z.string().min(1),
  humanReview: z.string().min(1),
});
export type AiArchitecture = z.infer<typeof aiArchitectureSchema>;

// ---------------------------------------------------------------------------
// Engineering safety
// ---------------------------------------------------------------------------

/**
 * Only present for engineering-related problems. The LLM must never be
 * treated as the authority for structural/safety-critical/material/
 * load/hydraulic/electrical or other regulated engineering decisions —
 * this block is where that separation is made explicit and structured,
 * not left to prose buried in `technologyApproach`.
 */
export const engineeringSafetySchema = z.object({
  deterministicCalculationsRequired: z.array(z.string().min(1)).default([]),
  aiMustNotDecide: z.array(z.string().min(1)).default([]),
  recommendedSolver: z.string().min(1).nullable(),
  applicableStandard: z.string().min(1).nullable(),
  humanVerificationRequired: z.boolean(),
  qualifiedProfessionalReviewRequired: z.boolean(),
  reasoning: z.string().min(1),
});
export type EngineeringSafety = z.infer<typeof engineeringSafetySchema>;

// ---------------------------------------------------------------------------
// System architecture & data flow
// ---------------------------------------------------------------------------

/** One node in the architecture graph. `dependsOn` references other components' `id`s so a future UI can render the relationships as a diagram. */
export const architectureComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
});
export type ArchitectureComponent = z.infer<typeof architectureComponentSchema>;

export const systemArchitectureSchema = z.object({
  inputs: z.array(architectureComponentSchema).default([]),
  processing: z.array(architectureComponentSchema).default([]),
  aiComponents: z.array(architectureComponentSchema).default([]),
  deterministicComponents: z.array(architectureComponentSchema).default([]),
  database: z.array(architectureComponentSchema).default([]),
  externalApis: z.array(architectureComponentSchema).default([]),
  hardware: z.array(architectureComponentSchema).default([]),
  outputs: z.array(architectureComponentSchema).default([]),
});
export type SystemArchitecture = z.infer<typeof systemArchitectureSchema>;

export const dataFlowStageKeySchema = z.enum([
  "INPUT",
  "INGESTION",
  "VALIDATION",
  "PROCESSING",
  "INTELLIGENCE",
  "DECISION",
  "OUTPUT",
]);
export type DataFlowStageKey = z.infer<typeof dataFlowStageKeySchema>;

export const dataFlowStageSchema = z.object({
  component: z.string().min(1),
  responsibility: z.string().min(1),
  input: z.string().min(1),
  output: z.string().min(1),
  dependency: z.string().min(1),
  risk: z.string().min(1),
});
export type DataFlowStage = z.infer<typeof dataFlowStageSchema>;

/** A fixed set of seven canonical stages, always all present — the same non-sparse shape Phase 03/06/07 establish for their own fixed checklists. */
export const dataFlowSchema = z.object({
  input: dataFlowStageSchema,
  ingestion: dataFlowStageSchema,
  validation: dataFlowStageSchema,
  processing: dataFlowStageSchema,
  intelligence: dataFlowStageSchema,
  decision: dataFlowStageSchema,
  output: dataFlowStageSchema,
});
export type DataFlow = z.infer<typeof dataFlowSchema>;

// ---------------------------------------------------------------------------
// User journey
// ---------------------------------------------------------------------------

export const userJourneyStageKeySchema = z.enum([
  "START",
  "INPUT",
  "ANALYSIS",
  "DISCOVERY",
  "RESEARCH",
  "DECISION",
  "SOLUTION",
  "VALIDATION",
]);
export type UserJourneyStageKey = z.infer<typeof userJourneyStageKeySchema>;

/** Not every project touches every canonical stage — "adapt it to the selected project mode" means this list may skip stages, never force all eight. */
export const userJourneyStageSchema = z.object({
  stage: userJourneyStageKeySchema,
  description: z.string().min(1),
});
export type UserJourneyStage = z.infer<typeof userJourneyStageSchema>;

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export const featureItemSchema = z.object({
  title: z.string().min(1),
  reasoning: z.string().min(1),
});
export type FeatureItem = z.infer<typeof featureItemSchema>;

/**
 * The one structure the CORE FEATURES section describes — "prioritize
 * the smallest set that delivers the validated value," never a giant
 * feature list. The Solution's own `coreFeatures`/`mustHaveFeatures`/
 * `futureFeatures` fields are computed by the phase composer as thin
 * projections of this single structure (mustHave/future respectively)
 * rather than asked of the model twice under different names.
 */
export const featureScopeSchema = z.object({
  mustHave: z.array(featureItemSchema).default([]),
  shouldHave: z.array(featureItemSchema).default([]),
  future: z.array(featureItemSchema).default([]),
  doNotBuild: z.array(featureItemSchema).default([]),
});
export type FeatureScope = z.infer<typeof featureScopeSchema>;

// ---------------------------------------------------------------------------
// Implementation plan (roadmap)
// ---------------------------------------------------------------------------

/** `estimatedEffort` reuses `marketNumberSchema` unchanged — MODEL_ESTIMATE with its calculation shown, never a verified duration. */
export const implementationStepSchema = z.object({
  stepNumber: z.number().int().min(0),
  objective: z.string().min(1),
  deliverable: z.string().min(1),
  dependency: z.string().min(1),
  estimatedEffort: marketNumberSchema,
  risk: z.string().min(1),
  completionCondition: z.string().min(1),
});
export type ImplementationStep = z.infer<typeof implementationStepSchema>;

// ---------------------------------------------------------------------------
// Solution risks (reusing Phase 07's risk vocabulary, never contradicting it)
// ---------------------------------------------------------------------------

/**
 * `sourceRiskId` references a Phase 07 `riskRegister` entry when this
 * risk carries one forward — the composer validates that reference
 * resolves, so a solution can never silently contradict what Phase 07
 * already found. A solution-specific risk (not present in Phase 07)
 * simply omits it.
 */
export const solutionRiskSchema = z.object({
  riskId: z.string().min(1),
  sourceRiskId: z.string().min(1).nullable(),
  title: z.string().min(1),
  category: riskCategorySchema,
  impact: qualitativeLevelSchema,
  mitigation: z.string().min(1),
  fallback: z.string().min(1),
  residualRisk: qualitativeLevelSchema,
  basis: scoreBasisSchema,
  confidence: qualitativeLevelSchema,
});
export type SolutionRisk = z.infer<typeof solutionRiskSchema>;

// ---------------------------------------------------------------------------
// POC definition & success metrics
// ---------------------------------------------------------------------------

export const pocDefinitionSchema = z.object({
  objective: z.string().min(1),
  scope: z.string().min(1),
  input: z.string().min(1),
  process: z.string().min(1),
  output: z.string().min(1),
  successCriteria: z.array(z.string().min(1)).min(1),
  failureCriteria: z.array(z.string().min(1)).min(1),
});
export type PocDefinition = z.infer<typeof pocDefinitionSchema>;

/**
 * A metric's target is either a stated goal (`TARGET`) or a modeled
 * prediction (`MODEL_ESTIMATE`) — never `VERIFIED`, since nothing has
 * been measured yet for a system that doesn't exist. This is
 * deliberately a narrower, POC-specific vocabulary than
 * `marketNumberSchema`'s VERIFIED/MODEL_ESTIMATE/UNKNOWN.
 */
export const successMetricStatusSchema = z.enum(["TARGET", "MODEL_ESTIMATE"]);
export type SuccessMetricStatus = z.infer<typeof successMetricStatusSchema>;

export const successMetricSchema = z.object({
  metric: z.string().min(1),
  targetValue: z.number().nullable(),
  unit: z.string().min(1).nullable(),
  status: successMetricStatusSchema,
  reasoning: z.string().min(1),
});
export type SuccessMetric = z.infer<typeof successMetricSchema>;

// ---------------------------------------------------------------------------
// Human in the loop
// ---------------------------------------------------------------------------

export const approvalTypeSchema = z.enum([
  "ENGINEERING",
  "GOVERNMENT",
  "MEDICAL",
  "FINANCIAL",
  "SAFETY",
  "DEPLOYMENT",
  "OTHER",
]);
export type ApprovalType = z.infer<typeof approvalTypeSchema>;

export const humanApprovalPointSchema = z.object({
  approvalType: approvalTypeSchema,
  description: z.string().min(1),
  required: z.boolean(),
  reasoning: z.string().min(1),
});
export type HumanApprovalPoint = z.infer<typeof humanApprovalPointSchema>;

// ---------------------------------------------------------------------------
// Technology stack
// ---------------------------------------------------------------------------

export const technologyChoiceSchema = z.object({
  category: z.string().min(1),
  technology: z.string().min(1),
  why: z.string().min(1),
  alternative: z.string().min(1),
  tradeoff: z.string().min(1),
  confidence: qualitativeLevelSchema,
});
export type TechnologyChoice = z.infer<typeof technologyChoiceSchema>;

// ---------------------------------------------------------------------------
// Solution reality check
// ---------------------------------------------------------------------------

export const solutionRealityStatusSchema = z.enum([
  "RECOMMENDED_TO_BUILD",
  "RECOMMENDED_WITH_CONSTRAINTS",
  "RESEARCH_BEFORE_BUILD",
  "NOT_RECOMMENDED",
  "INSUFFICIENT_EVIDENCE",
]);
export type SolutionRealityStatus = z.infer<typeof solutionRealityStatusSchema>;

/** Dynamically generated per run — never a hard-coded boilerplate line. */
export const solutionRealityCheckSchema = z.object({
  status: solutionRealityStatusSchema,
  explanation: z.string().min(1),
});
export type SolutionRealityCheck = z.infer<typeof solutionRealityCheckSchema>;

// ---------------------------------------------------------------------------
// Mode-specific plans (exactly one populated, mirroring Phase 07's
// modeFeasibility pattern)
// ---------------------------------------------------------------------------

export const hackathonSolutionPlanSchema = z.object({
  buildPlan24Hour: z.array(z.string().min(1)).min(1),
  demoFlow: z.array(z.string().min(1)).min(1),
  mustBuild: z.array(featureItemSchema).default([]),
  shouldBuild: z.array(featureItemSchema).default([]),
  doNotBuild: z.array(featureItemSchema).default([]),
  demoNarrative: z.string().min(1),
  judgeFacingValueProposition: z.string().min(1),
});
export type HackathonSolutionPlan = z.infer<typeof hackathonSolutionPlanSchema>;

export const pblSolutionPlanSchema = z.object({
  academicObjective: z.string().min(1),
  methodology: z.string().min(1),
  implementation: z.string().min(1),
  experimentation: z.string().min(1),
  testing: z.string().min(1),
  documentation: z.string().min(1),
  evaluationMetrics: z.array(z.string().min(1)).default([]),
  presentationStructure: z.array(z.string().min(1)).min(1),
});
export type PblSolutionPlan = z.infer<typeof pblSolutionPlanSchema>;

export const startupSolutionPlanSchema = z.object({
  productScope: z.string().min(1),
  customerValue: z.string().min(1),
  businessModel: z.string().min(1),
  deployment: z.string().min(1),
  scaling: z.string().min(1),
  security: z.string().min(1),
  operations: z.string().min(1),
  roadmapSummary: z.string().min(1),
});
export type StartupSolutionPlan = z.infer<typeof startupSolutionPlanSchema>;

export const researchSolutionPlanSchema = z.object({
  researchQuestion: z.string().min(1),
  hypothesis: z.string().min(1).nullable(),
  methodology: z.string().min(1),
  experimentalDesign: z.string().min(1),
  evaluation: z.string().min(1),
  limitations: z.array(z.string().min(1)).default([]),
  futureResearch: z.array(z.string().min(1)).default([]),
});
export type ResearchSolutionPlan = z.infer<typeof researchSolutionPlanSchema>;

export const zeroDegreeSolutionPlanSchema = z.object({
  strategicFit: z.string().min(1),
  communityValue: z.string().min(1),
  productization: z.string().min(1),
  reusability: z.string().min(1),
  teamCapability: z.string().min(1),
  futureCommercialization: z.string().min(1),
  researchPotential: z.string().min(1),
});
export type ZeroDegreeSolutionPlan = z.infer<typeof zeroDegreeSolutionPlanSchema>;

/** Exactly one of these five is populated — the one matching `context.mode` — and the rest are `null`. The phase composer enforces that invariant. */
export const modeSolutionPlanSchema = z.object({
  mode: projectModeSchema,
  hackathon: hackathonSolutionPlanSchema.nullable(),
  pbl: pblSolutionPlanSchema.nullable(),
  startup: startupSolutionPlanSchema.nullable(),
  research: researchSolutionPlanSchema.nullable(),
  zeroDegree: zeroDegreeSolutionPlanSchema.nullable(),
});
export type ModeSolutionPlan = z.infer<typeof modeSolutionPlanSchema>;

// ---------------------------------------------------------------------------
// The Solution itself
// ---------------------------------------------------------------------------

/**
 * `coreFeatures`/`mustHaveFeatures`/`futureFeatures` are populated by
 * the phase composer as thin projections of `featureScope`
 * (mustHave/mustHave/future respectively) — the model authors one
 * structure, never the same feature list twice under different field
 * names. `validatedGapId` and `opportunityId` must resolve against
 * Phase 04/05's actual data, and `opportunityId` must be the selected
 * leading opportunity specifically — both enforced by the phase
 * composer, not merely requested here.
 */
export const solutionSchema = z.object({
  solutionId: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  executiveSummary: z.string().min(1),
  problemAddressed: richEvidenceClaimSchema,
  /** Phase 02 stakeholder localIds. */
  primaryUsers: z.array(z.string().min(1)).default([]),
  customers: z.array(z.string().min(1)).default([]),
  beneficiaries: z.array(z.string().min(1)).default([]),
  coreValueProposition: z.string().min(1),
  /** A Phase 04 gap id. */
  validatedGapId: z.string().min(1),
  /** A Phase 05 opportunity id — must be the selected leading opportunity. */
  opportunityId: z.string().min(1),
  differentiation: differentiationSchema,
  solutionType: solutionTypeSchema,
  technologyApproach: z.string().min(1),
  aiRole: aiRoleSchema,
  /** Null when hardware isn't genuinely involved. */
  hardwareRole: z.string().min(1).nullable(),
  softwareRole: z.string().min(1).nullable(),
  dataRole: z.string().min(1).nullable(),
  workflow: z.array(z.string().min(1)).min(1),
  architecture: systemArchitectureSchema,
  userJourney: z.array(userJourneyStageSchema).min(1),
  coreFeatures: z.array(featureItemSchema).default([]),
  mustHaveFeatures: z.array(featureItemSchema).default([]),
  futureFeatures: z.array(featureItemSchema).default([]),
  implementationPlan: z.array(implementationStepSchema).min(1),
  risks: z.array(solutionRiskSchema).default([]),
  limitations: z.array(z.string().min(1)).default([]),
  evidenceClaims: z.array(richEvidenceClaimSchema).default([]),
  confidence: qualitativeLevelSchema,
});
export type Solution = z.infer<typeof solutionSchema>;

// ---------------------------------------------------------------------------
// Full agent output
// ---------------------------------------------------------------------------

/**
 * What the Solution Consultant Agent produces — a single Gemini call,
 * per the phase catalog's own `agents: ["solution_consultant"]` roster
 * entry. `solution` is `null` precisely when Phase 05 concluded
 * `NO_MEANINGFUL_OPPORTUNITY` — PRISM must not manufacture a solution
 * when there's nothing real to build on; the composer enforces this
 * coupling. `featureScope`, `dataFlow`, `alternativesConsidered`, and
 * every other structural section live at the top level (not nested
 * under `solution`) because they describe the recommendation process
 * itself, not just the recommended solution's own data model.
 */
export const solutionConsultantOutputSchema = z.object({
  solution: solutionSchema.nullable(),
  whyThisSolution: whyThisSolutionSchema.nullable(),
  alternativesConsidered: z.array(alternativeConsideredSchema).default([]),
  featureScope: featureScopeSchema.nullable(),
  dataFlow: dataFlowSchema.nullable(),
  /** Only present for engineering-related problems. */
  engineeringSafety: engineeringSafetySchema.nullable(),
  /** Only present when AI genuinely plays a role. */
  aiArchitecture: aiArchitectureSchema.nullable(),
  humanInTheLoop: z.array(humanApprovalPointSchema).default([]),
  technologyStack: z.array(technologyChoiceSchema).default([]),
  pocDefinition: pocDefinitionSchema.nullable(),
  successMetrics: z.array(successMetricSchema).default([]),
  modeSolutionPlan: modeSolutionPlanSchema,
  /** Every Phase 07 critical blocker's title, restated here — the composer rejects output that drops one silently when Phase 07 identified any. */
  acknowledgedCriticalBlockers: z.array(z.string().min(1)).default([]),
  solutionRealityCheck: solutionRealityCheckSchema,
  evidenceSummary: z.object({
    narrative: z.string().min(1),
  }),
  confidenceSummary: z.object({
    overallConfidence: confidenceLevelSchema,
    narrative: z.string().min(1),
  }),
  /** Short, contextual PRISM-voice remark reacting to the actual findings — never a hard-coded line. */
  consultantMessage: z.string().min(1),
});
export type SolutionConsultantOutput = z.infer<typeof solutionConsultantOutputSchema>;
