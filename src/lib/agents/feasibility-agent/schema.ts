import { z } from "zod";

import { scalabilityAssessmentSchema } from "@/lib/agents/market-agent/schema";
import { confidenceLevelSchema } from "@/lib/prism/confidence";
import { richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { marketNumberSchema } from "@/lib/prism/market";
import { projectModeSchema } from "@/lib/prism/modes";
import { qualitativeLevelSchema, scoreBasisSchema, scoreSchema } from "@/lib/prism/scoring";

// ---------------------------------------------------------------------------
// Mode-aware feasibility
// ---------------------------------------------------------------------------

/**
 * HACKATHON is the one mode where "what NOT to build" matters as much as
 * what to build — a team that spends its 24 hours on the wrong thing
 * fails the same way a team with no plan does.
 */
export const hackathonDurationSchema = z.enum(["24_HOUR", "48_HOUR", "1_WEEK"]);
export type HackathonDuration = z.infer<typeof hackathonDurationSchema>;

export const hackathonDurationAssessmentSchema = z.object({
  duration: hackathonDurationSchema,
  status: z.enum(["FEASIBLE", "CONDITIONALLY_FEASIBLE", "DIFFICULT", "INFEASIBLE", "UNKNOWN"]),
  reasoning: z.string().min(1),
});
export type HackathonDurationAssessment = z.infer<typeof hackathonDurationAssessmentSchema>;

export const hackathonFeasibilityAssessmentSchema = z.object({
  timeAvailable: richEvidenceClaimSchema,
  teamSize: richEvidenceClaimSchema,
  teamSkills: richEvidenceClaimSchema,
  hardwareAccess: richEvidenceClaimSchema,
  softwareAccess: richEvidenceClaimSchema,
  apiAccess: richEvidenceClaimSchema,
  dataAccess: richEvidenceClaimSchema,
  prototypeScope: z.string().min(1),
  demoScope: z.string().min(1),
  deploymentScope: z.string().min(1),
  /** Only the durations genuinely relevant to the actual timeline under consideration. */
  durationFeasibility: z.array(hackathonDurationAssessmentSchema).default([]),
});
export type HackathonFeasibilityAssessment = z.infer<typeof hackathonFeasibilityAssessmentSchema>;

export const pblFeasibilityAssessmentSchema = z.object({
  academicScope: richEvidenceClaimSchema,
  problemDefinition: richEvidenceClaimSchema,
  methodology: richEvidenceClaimSchema,
  implementation: richEvidenceClaimSchema,
  experimentation: richEvidenceClaimSchema,
  testing: richEvidenceClaimSchema,
  documentation: richEvidenceClaimSchema,
  evaluation: richEvidenceClaimSchema,
  timeline: richEvidenceClaimSchema,
  teamCapability: richEvidenceClaimSchema,
});
export type PblFeasibilityAssessment = z.infer<typeof pblFeasibilityAssessmentSchema>;

/**
 * Startup-unique angles only — technical/data/cost/scalability/team are
 * already covered by the universal sections below, so this doesn't
 * repeat them; it captures what's genuinely specific to a commercial
 * launch (customer deployment, compliance, operational readiness).
 */
export const startupFeasibilityAssessmentSchema = z.object({
  customerDeployment: richEvidenceClaimSchema,
  complianceRequirements: richEvidenceClaimSchema,
  operationalReadiness: richEvidenceClaimSchema,
  notes: z.string().min(1),
});
export type StartupFeasibilityAssessment = z.infer<typeof startupFeasibilityAssessmentSchema>;

export const researchFeasibilityAssessmentSchema = z.object({
  researchQuestion: z.string().min(1),
  novelty: richEvidenceClaimSchema,
  methodology: richEvidenceClaimSchema,
  experimentalDesign: richEvidenceClaimSchema,
  reproducibility: richEvidenceClaimSchema,
  limitations: z.array(z.string().min(1)).default([]),
});
export type ResearchFeasibilityAssessment = z.infer<typeof researchFeasibilityAssessmentSchema>;

export const zeroDegreeFeasibilityAssessmentSchema = z.object({
  strategicFit: richEvidenceClaimSchema,
  productizationPotential: richEvidenceClaimSchema,
  reusePotential: richEvidenceClaimSchema,
  communityValue: richEvidenceClaimSchema,
  researchValue: richEvidenceClaimSchema,
  futureCommercialization: richEvidenceClaimSchema,
  ecosystemFit: richEvidenceClaimSchema,
});
export type ZeroDegreeFeasibilityAssessment = z.infer<typeof zeroDegreeFeasibilityAssessmentSchema>;

/**
 * Exactly one of these five is populated — the one matching
 * `context.mode` — and the rest are `null`. The phase composer enforces
 * that invariant; the schema only shapes each block.
 */
export const modeFeasibilitySchema = z.object({
  mode: projectModeSchema,
  hackathon: hackathonFeasibilityAssessmentSchema.nullable(),
  pbl: pblFeasibilityAssessmentSchema.nullable(),
  startup: startupFeasibilityAssessmentSchema.nullable(),
  research: researchFeasibilityAssessmentSchema.nullable(),
  zeroDegree: zeroDegreeFeasibilityAssessmentSchema.nullable(),
});
export type ModeFeasibility = z.infer<typeof modeFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Technical feasibility
// ---------------------------------------------------------------------------

export const technicalFeasibilityStatusSchema = z.enum([
  "FEASIBLE",
  "CONDITIONALLY_FEASIBLE",
  "DIFFICULT",
  "INFEASIBLE",
  "UNKNOWN",
]);
export type TechnicalFeasibilityStatus = z.infer<typeof technicalFeasibilityStatusSchema>;

export const technicalDimensionAssessmentSchema = z.object({
  status: technicalFeasibilityStatusSchema,
  reasoning: z.string().min(1),
  confidence: qualitativeLevelSchema,
  evidenceClaims: z.array(richEvidenceClaimSchema).default([]),
});
export type TechnicalDimensionAssessment = z.infer<typeof technicalDimensionAssessmentSchema>;

/** A fixed set of thirteen dimensions, always all present — the same non-sparse shape as Phase 03's `researchCoverageSchema`. */
export const technicalFeasibilitySchema = z.object({
  architecture: technicalDimensionAssessmentSchema,
  technologyMaturity: technicalDimensionAssessmentSchema,
  dependencies: technicalDimensionAssessmentSchema,
  apis: technicalDimensionAssessmentSchema,
  hardware: technicalDimensionAssessmentSchema,
  software: technicalDimensionAssessmentSchema,
  data: technicalDimensionAssessmentSchema,
  infrastructure: technicalDimensionAssessmentSchema,
  integration: technicalDimensionAssessmentSchema,
  security: technicalDimensionAssessmentSchema,
  performance: technicalDimensionAssessmentSchema,
  reliability: technicalDimensionAssessmentSchema,
  maintenance: technicalDimensionAssessmentSchema,
});
export type TechnicalFeasibility = z.infer<typeof technicalFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Data feasibility
// ---------------------------------------------------------------------------

export const dataAvailabilitySchema = z.enum([
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
  "RESTRICTED",
  "UNAVAILABLE",
  "UNKNOWN",
]);
export type DataAvailability = z.infer<typeof dataAvailabilitySchema>;

/** One required dataset/data dependency. Never assume a dataset exists — if one is mentioned, ground it in actual upstream evidence where possible. */
export const dataRequirementEntrySchema = z.object({
  requiredData: z.string().min(1),
  dataSource: z.string().min(1),
  availability: dataAvailabilitySchema,
  quality: richEvidenceClaimSchema,
  accessibility: richEvidenceClaimSchema,
  privacy: richEvidenceClaimSchema,
  licensing: richEvidenceClaimSchema,
  updateFrequency: z.string().min(1),
});
export type DataRequirementEntry = z.infer<typeof dataRequirementEntrySchema>;

export const dataFeasibilitySchema = z.object({
  /** Deliberately not `.min(1)` — a project with no notable data dependency is a legitimate, honest case. */
  requirements: z.array(dataRequirementEntrySchema).default([]),
  narrative: z.string().min(1),
});
export type DataFeasibility = z.infer<typeof dataFeasibilitySchema>;

// ---------------------------------------------------------------------------
// AI feasibility (nullable — only when the opportunity actually proposes AI)
// ---------------------------------------------------------------------------

export const aiFeasibilityClassificationSchema = z.enum([
  "AI_REQUIRED",
  "AI_FEASIBLE",
  "AI_RISKY",
  "AI_NOT_NEEDED",
]);
export type AiFeasibilityClassification = z.infer<typeof aiFeasibilityClassificationSchema>;

export const aiFeasibilitySchema = z.object({
  classification: aiFeasibilityClassificationSchema,
  modelAvailability: richEvidenceClaimSchema,
  trainingRequirement: richEvidenceClaimSchema,
  inferenceRequirement: richEvidenceClaimSchema,
  dataRequirement: richEvidenceClaimSchema,
  latency: richEvidenceClaimSchema,
  cost: marketNumberSchema,
  accuracyRequirements: richEvidenceClaimSchema,
  explainability: richEvidenceClaimSchema,
  deployment: richEvidenceClaimSchema,
  reasoning: z.string().min(1),
});
export type AiFeasibility = z.infer<typeof aiFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Hardware feasibility (nullable — only when hardware is actually involved)
// ---------------------------------------------------------------------------

/** `cost`'s own `marketNumberSchema` rules are what prevent inventing a component price — UNKNOWN is required absent real pricing evidence. */
export const hardwareFeasibilitySchema = z.object({
  componentAvailability: richEvidenceClaimSchema,
  sensorAvailability: richEvidenceClaimSchema,
  controller: richEvidenceClaimSchema,
  power: richEvidenceClaimSchema,
  communications: richEvidenceClaimSchema,
  fabrication: richEvidenceClaimSchema,
  cost: marketNumberSchema,
  integration: richEvidenceClaimSchema,
  fieldDeployment: richEvidenceClaimSchema,
  maintenance: richEvidenceClaimSchema,
});
export type HardwareFeasibility = z.infer<typeof hardwareFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Software feasibility
// ---------------------------------------------------------------------------

export const softwareComponentStatusSchema = z.enum([
  "AVAILABLE_NOW",
  "REQUIRES_BUILD",
  "REQUIRES_CUSTOM_RESEARCH",
  "HIGH_RISK_DEPENDENCY",
]);
export type SoftwareComponentStatus = z.infer<typeof softwareComponentStatusSchema>;

export const softwareComponentAssessmentSchema = z.object({
  status: softwareComponentStatusSchema,
  reasoning: z.string().min(1),
});
export type SoftwareComponentAssessment = z.infer<typeof softwareComponentAssessmentSchema>;

/** A fixed set of nine components, always all present. */
export const softwareFeasibilitySchema = z.object({
  frontend: softwareComponentAssessmentSchema,
  backend: softwareComponentAssessmentSchema,
  database: softwareComponentAssessmentSchema,
  api: softwareComponentAssessmentSchema,
  authentication: softwareComponentAssessmentSchema,
  deployment: softwareComponentAssessmentSchema,
  mobileOrWeb: softwareComponentAssessmentSchema,
  thirdPartyServices: softwareComponentAssessmentSchema,
  openSourceDependencies: softwareComponentAssessmentSchema,
});
export type SoftwareFeasibility = z.infer<typeof softwareFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Team feasibility
// ---------------------------------------------------------------------------

export const teamSkillAreaSchema = z.enum([
  "FRONTEND",
  "BACKEND",
  "AI_ML",
  "CIVIL_ENGINEERING",
  "ELECTRONICS",
  "MECHANICAL",
  "DESIGN",
  "RESEARCH",
  "BUSINESS",
  "DOMAIN_EXPERT",
]);
export type TeamSkillArea = z.infer<typeof teamSkillAreaSchema>;

/** `teamHasCapability` must be `UNKNOWN` rather than guessed — PRISM has no real roster to check against unless one was actually provided. */
export const teamSkillAssessmentSchema = z.object({
  skillArea: teamSkillAreaSchema,
  required: z.boolean(),
  teamHasCapability: z.enum(["YES", "NO", "PARTIAL", "UNKNOWN"]),
  reasoning: z.string().min(1),
});
export type TeamSkillAssessment = z.infer<typeof teamSkillAssessmentSchema>;

export const teamFeasibilitySchema = z.object({
  /** Only the skill areas genuinely implicated by this opportunity — never force all ten. */
  skills: z.array(teamSkillAssessmentSchema).default([]),
  narrative: z.string().min(1),
});
export type TeamFeasibility = z.infer<typeof teamFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Time feasibility
// ---------------------------------------------------------------------------

/** Every duration is a `marketNumberSchema` — MODEL_ESTIMATE with its calculation shown, never presented as a verified fact. */
export const timeFeasibilitySchema = z.object({
  minimumViableBuildTime: marketNumberSchema,
  prototypeTime: marketNumberSchema,
  productionTime: marketNumberSchema,
  /** Populated only under HACKATHON mode. */
  hackathonDurationFeasibility: z.array(hackathonDurationAssessmentSchema).default([]),
});
export type TimeFeasibility = z.infer<typeof timeFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Cost feasibility
// ---------------------------------------------------------------------------

export const costFeasibilitySchema = z.object({
  developmentCost: marketNumberSchema,
  hardwareCost: marketNumberSchema,
  softwareCost: marketNumberSchema,
  apiCost: marketNumberSchema,
  infrastructureCost: marketNumberSchema,
  deploymentCost: marketNumberSchema,
  maintenanceCost: marketNumberSchema,
});
export type CostFeasibility = z.infer<typeof costFeasibilitySchema>;

// ---------------------------------------------------------------------------
// Regulatory & safety
// ---------------------------------------------------------------------------

export const regulatoryItemSchema = z.object({
  area: z.string().min(1),
  requirement: richEvidenceClaimSchema,
});
export type RegulatoryItem = z.infer<typeof regulatoryItemSchema>;

export const regulatorySafetySchema = z.object({
  /** Deliberately not `.min(1)` — many projects genuinely have no notable regulatory surface. */
  items: z.array(regulatoryItemSchema).default([]),
  narrative: z.string().min(1),
});
export type RegulatorySafety = z.infer<typeof regulatorySafetySchema>;

// ---------------------------------------------------------------------------
// Security & privacy
// ---------------------------------------------------------------------------

export const securityRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
export type SecurityRiskLevel = z.infer<typeof securityRiskLevelSchema>;

export const securityConsiderationKeySchema = z.enum([
  "PII",
  "SENSITIVE_DATA",
  "AUTHENTICATION",
  "AUTHORIZATION",
  "DATA_RETENTION",
  "DATA_SHARING",
  "API_SECURITY",
  "MODEL_SECURITY",
]);
export type SecurityConsiderationKey = z.infer<typeof securityConsiderationKeySchema>;

export const securityConsiderationSchema = z.object({
  consideration: securityConsiderationKeySchema,
  assessment: richEvidenceClaimSchema,
});
export type SecurityConsideration = z.infer<typeof securityConsiderationSchema>;

export const securityPrivacySchema = z.object({
  /** Only the considerations genuinely relevant to this opportunity. */
  considerations: z.array(securityConsiderationSchema).default([]),
  securityRisk: securityRiskLevelSchema,
  reasoning: z.string().min(1),
});
export type SecurityPrivacy = z.infer<typeof securityPrivacySchema>;

// ---------------------------------------------------------------------------
// Scalability (Phase 07's own seven dimensions — deliberately different
// from Phase 06's, which swaps "customer" for "infrastructure")
// ---------------------------------------------------------------------------

export const feasibilityScalabilitySchema = z.object({
  technical: scalabilityAssessmentSchema,
  data: scalabilityAssessmentSchema,
  infrastructure: scalabilityAssessmentSchema,
  operational: scalabilityAssessmentSchema,
  support: scalabilityAssessmentSchema,
  geographic: scalabilityAssessmentSchema,
  regulatory: scalabilityAssessmentSchema,
});
export type FeasibilityScalability = z.infer<typeof feasibilityScalabilitySchema>;

// ---------------------------------------------------------------------------
// Risk register
// ---------------------------------------------------------------------------

export const riskCategorySchema = z.enum([
  "TECHNICAL",
  "DATA",
  "TEAM",
  "TIME",
  "COST",
  "MARKET",
  "REGULATORY",
  "SECURITY",
  "OPERATIONAL",
  "DEPENDENCY",
  "OTHER",
]);
export type RiskCategory = z.infer<typeof riskCategorySchema>;

/** `basis` reuses the existing `Score` vocabulary's "ai_estimate" label — exactly the "MODEL_ESTIMATE" the spec asks for, no new vocabulary needed. Likelihood/impact/severity are qualitative bands, never a fabricated numeric probability. */
export const riskEntrySchema = z.object({
  riskId: z.string().min(1),
  title: z.string().min(1),
  category: riskCategorySchema,
  description: z.string().min(1),
  likelihood: qualitativeLevelSchema,
  impact: qualitativeLevelSchema,
  severity: qualitativeLevelSchema,
  mitigation: z.string().min(1),
  residualRisk: qualitativeLevelSchema,
  basis: scoreBasisSchema,
  confidence: qualitativeLevelSchema,
});
export type RiskEntry = z.infer<typeof riskEntrySchema>;

// ---------------------------------------------------------------------------
// Build scope
// ---------------------------------------------------------------------------

export const buildScopeItemSchema = z.object({
  title: z.string().min(1),
  reasoning: z.string().min(1),
});
export type BuildScopeItem = z.infer<typeof buildScopeItemSchema>;

/**
 * One universal build-scope structure whose prioritization lens shifts
 * by mode (HACKATHON: demonstrable value; STARTUP: deployable customer
 * value; PBL: academic completeness) rather than five separate,
 * duplicate build-scope shapes per mode.
 */
export const buildScopeSchema = z.object({
  mustBuild: z.array(buildScopeItemSchema).default([]),
  shouldBuild: z.array(buildScopeItemSchema).default([]),
  couldBuild: z.array(buildScopeItemSchema).default([]),
  doNotBuild: z.array(buildScopeItemSchema).default([]),
});
export type BuildScope = z.infer<typeof buildScopeSchema>;

// ---------------------------------------------------------------------------
// Feasibility scores
// ---------------------------------------------------------------------------

export const feasibilityScoresSchema = z.object({
  technical: scoreSchema,
  data: scoreSchema,
  time: scoreSchema,
  cost: scoreSchema,
  team: scoreSchema,
  deployment: scoreSchema,
  scalability: scoreSchema,
});
export type FeasibilityScores = z.infer<typeof feasibilityScoresSchema>;

// ---------------------------------------------------------------------------
// Overall feasibility, critical blockers, reality check
// ---------------------------------------------------------------------------

export const overallFeasibilityStatusSchema = z.enum([
  "HIGHLY_FEASIBLE",
  "FEASIBLE",
  "CONDITIONALLY_FEASIBLE",
  "DIFFICULT",
  "INFEASIBLE",
  "INSUFFICIENT_EVIDENCE",
]);
export type OverallFeasibilityStatus = z.infer<typeof overallFeasibilityStatusSchema>;

export const overallFeasibilitySchema = z.object({
  status: overallFeasibilityStatusSchema,
  explanation: z.string().min(1),
});
export type OverallFeasibility = z.infer<typeof overallFeasibilitySchema>;

export const criticalBlockerSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: riskCategorySchema,
});
export type CriticalBlocker = z.infer<typeof criticalBlockerSchema>;

export const feasibilityRealitySignalSchema = z.enum([
  "READY_TO_BUILD",
  "BUILDABLE_WITH_CONSTRAINTS",
  "HIGH_RISK_BUILD",
  "NOT_FEASIBLE_NOW",
  "INSUFFICIENT_EVIDENCE",
]);
export type FeasibilityRealitySignal = z.infer<typeof feasibilityRealitySignalSchema>;

/** Dynamically generated per run — never a hard-coded boilerplate line. */
export const feasibilityRealityCheckSchema = z.object({
  signal: feasibilityRealitySignalSchema,
  explanation: z.string().min(1),
});
export type FeasibilityRealityCheck = z.infer<typeof feasibilityRealityCheckSchema>;

// ---------------------------------------------------------------------------
// Implementation roadmap
// ---------------------------------------------------------------------------

/** No fixed phase count — "do not assume all projects need the same phases." */
export const roadmapPhaseSchema = z.object({
  phaseNumber: z.number().int().min(0),
  title: z.string().min(1),
  description: z.string().min(1),
  deliverables: z.array(z.string().min(1)).default([]),
});
export type RoadmapPhase = z.infer<typeof roadmapPhaseSchema>;

// ---------------------------------------------------------------------------
// Full agent output
// ---------------------------------------------------------------------------

/**
 * What the Feasibility Agent produces on its own — a single Gemini call,
 * per the phase catalog's own `agents: ["feasibility_agent"]` roster
 * entry. `evidenceSummary` here carries only the model's own qualitative
 * `narrative`; the phase composer computes the numeric counts, the same
 * split Phase 04's gap-agent establishes.
 */
export const feasibilityAgentOutputSchema = z.object({
  modeFeasibility: modeFeasibilitySchema,
  technicalFeasibility: technicalFeasibilitySchema,
  dataFeasibility: dataFeasibilitySchema,
  aiFeasibility: aiFeasibilitySchema.nullable(),
  hardwareFeasibility: hardwareFeasibilitySchema.nullable(),
  softwareFeasibility: softwareFeasibilitySchema,
  teamFeasibility: teamFeasibilitySchema,
  timeFeasibility: timeFeasibilitySchema,
  costFeasibility: costFeasibilitySchema,
  regulatorySafety: regulatorySafetySchema,
  securityPrivacy: securityPrivacySchema,
  scalability: feasibilityScalabilitySchema,
  riskRegister: z.array(riskEntrySchema).default([]),
  buildScope: buildScopeSchema,
  feasibilityScores: feasibilityScoresSchema,
  overallFeasibility: overallFeasibilitySchema,
  /** Deliberately not `.min(1)` — an empty list IS "NONE_IDENTIFIED"; the composer derives that literal summary from this list's length rather than asking the model to write the sentinel itself. */
  criticalBlockers: z.array(criticalBlockerSchema).default([]),
  feasibilityRealityCheck: feasibilityRealityCheckSchema,
  implementationRoadmap: z.array(roadmapPhaseSchema).min(1),
  validationQuestions: z.array(z.string().min(1)).default([]),
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
export type FeasibilityAgentOutput = z.infer<typeof feasibilityAgentOutputSchema>;
