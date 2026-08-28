import { z } from "zod";

import { buildRichEvidenceClaimSchema, richEvidenceClaimSchema } from "@/lib/prism/evidence";
import { idRefArraySchema } from "@/lib/prism/id-refs";
import { buildMarketNumberSchema, marketNumberSchema } from "@/lib/prism/market";
import { qualitativeLevelSchema, scoreSchema } from "@/lib/prism/scoring";

/**
 * A market/commercial-lens role vocabulary — deliberately distinct from
 * Phase 02's `StakeholderRole` (a problem/pain lens: USER, CONSUMER,
 * BUYER, BENEFICIARY, OPERATOR, DECISION_MAKER, INFLUENCER, REGULATOR,
 * IMPLEMENTER, AFFECTED_PARTY). Phase 06's spec asks for this exact set
 * (CUSTOMER and OWNER aren't in Phase 02's list at all), the same
 * "keep the phase's own literal vocabulary, don't force-fit an existing
 * one" precedent Phase 04's `gapConfidenceLevelSchema` established. A
 * single stakeholder can carry more than one role.
 */
export const marketRoleSchema = z.enum([
  "USER",
  "CUSTOMER",
  "BUYER",
  "BENEFICIARY",
  "OPERATOR",
  "OWNER",
  "DECISION_MAKER",
  "REGULATOR",
  "INFLUENCER",
]);
export type MarketRole = z.infer<typeof marketRoleSchema>;

export const roleAssignmentSchema = z.object({
  /** A Phase 02 stakeholder localId when one genuinely applies, otherwise a short free-text label. */
  stakeholderRef: z.string().min(1),
  roles: z.array(marketRoleSchema).min(1),
  reasoning: z.string().min(1),
});
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;

/**
 * The five questions the spec requires for the leading opportunity.
 * Each is a `richEvidenceClaim` so "UNKNOWN" is an explicit, expected
 * status rather than an omitted field — never guessed to fill the slot.
 */
export const customerModelSchema = z.object({
  whoExperiencesThePain: richEvidenceClaimSchema,
  whoUsesTheSolution: richEvidenceClaimSchema,
  whoPays: richEvidenceClaimSchema,
  whoApproves: richEvidenceClaimSchema,
  whoBenefits: richEvidenceClaimSchema,
  roleAssignments: z.array(roleAssignmentSchema).default([]),
});
export type CustomerModel = z.infer<typeof customerModelSchema>;

export const marketSegmentCategorySchema = z.enum([
  "B2C",
  "B2B",
  "B2G",
  "B2B2C",
  "EDUCATION",
  "HEALTHCARE",
  "INFRASTRUCTURE",
  "CONSTRUCTION",
  "MANUFACTURING",
  "AGRICULTURE",
  "MOBILITY",
  "PUBLIC_SECTOR",
  "ENTERPRISE",
  "SMB",
  "OTHER",
]);
export type MarketSegmentCategory = z.infer<typeof marketSegmentCategorySchema>;

/** Only genuinely relevant segments should appear — never a padded full list. */
export const marketSegmentEntrySchema = z.object({
  segment: marketSegmentCategorySchema,
  need: z.string().min(1),
  buyer: z.string().min(1),
  user: z.string().min(1),
  pain: z.string().min(1),
  adoptionBarrier: z.string().min(1),
  opportunityRelevance: qualitativeLevelSchema,
  confidence: qualitativeLevelSchema,
});
export type MarketSegmentEntry = z.infer<typeof marketSegmentEntrySchema>;

export const competitorClassificationSchema = z.enum([
  "DIRECT",
  "INDIRECT",
  "SUBSTITUTE",
  "INTERNAL_WORKAROUND",
  "EMERGING",
]);
export type CompetitorClassification = z.infer<typeof competitorClassificationSchema>;

/**
 * `marketPositionIfVerified` is where "don't claim market leadership
 * without evidence" is enforced: the phase composer mechanically rejects
 * language like "market leader"/"dominant"/"largest" here unless
 * `status` is `VERIFIED` — the same anti-overclaim discipline Phase 05
 * applies to differentiation claims.
 */
export const competitorEntrySchema = z.object({
  name: z.string().min(1),
  organization: z.string().min(1),
  solution: z.string().min(1),
  targetCustomer: z.string().min(1),
  classification: competitorClassificationSchema,
  strength: richEvidenceClaimSchema,
  limitation: richEvidenceClaimSchema,
  marketPositionIfVerified: richEvidenceClaimSchema,
  sourceIds: z.array(z.string().min(1)).default([]),
  confidence: qualitativeLevelSchema,
});
export type CompetitorEntry = z.infer<typeof competitorEntrySchema>;

/**
 * `summary` being a `richEvidenceClaim` is what makes "do not claim 'no
 * competitors' unless research genuinely supports that conclusion"
 * mechanically enforced, for free: a `VERIFIED` claim with zero cited
 * sources is already rejected at the schema level (see
 * `richEvidenceClaimSchema`), so a `VERIFIED` "no competitors identified"
 * conclusion can only exist if it actually cites the research that
 * supports it.
 */
export const competitiveLandscapeSchema = z.object({
  competitors: z.array(competitorEntrySchema).default([]),
  summary: richEvidenceClaimSchema,
});
export type CompetitiveLandscape = z.infer<typeof competitiveLandscapeSchema>;

export const adoptionFactorKeySchema = z.enum([
  "SWITCHING_COST",
  "TRUST",
  "PROCUREMENT",
  "TRAINING",
  "INTEGRATION",
  "REGULATORY_BARRIERS",
  "BEHAVIOR_CHANGE",
  "BUDGET_AVAILABILITY",
  "DEPLOYMENT_COMPLEXITY",
]);
export type AdoptionFactorKey = z.infer<typeof adoptionFactorKeySchema>;

/** Only factors genuinely relevant to this opportunity should appear. */
export const adoptionFactorSchema = z.object({
  factor: adoptionFactorKeySchema,
  assessment: richEvidenceClaimSchema,
});
export type AdoptionFactor = z.infer<typeof adoptionFactorSchema>;

export const adoptionRiskSchema = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
export type AdoptionRisk = z.infer<typeof adoptionRiskSchema>;

export const adoptionAnalysisSchema = z.object({
  factors: z.array(adoptionFactorSchema).default([]),
  adoptionRisk: adoptionRiskSchema,
  reasoning: z.string().min(1),
});
export type AdoptionAnalysis = z.infer<typeof adoptionAnalysisSchema>;

export const marketDriversSchema = z.object({
  /** What drives adoption. */
  adoptionDrivers: z.array(richEvidenceClaimSchema).default([]),
  /** What prevents adoption. "What competes for the same budget/workflow" is answered by `competitiveLandscape`'s SUBSTITUTE/INTERNAL_WORKAROUND entries, not duplicated here. */
  adoptionBarriers: z.array(richEvidenceClaimSchema).default([]),
});
export type MarketDrivers = z.infer<typeof marketDriversSchema>;

/** Reused for TAM, SAM, and SOM alike — the shape is identical, only the scope definition and value differ. */
export const marketSizeAnalysisSchema = z.object({
  /** How this market was scoped (geography, segment, customer type) — required even when the value itself is UNKNOWN, so a reader can see *what* couldn't be sized. */
  definition: z.string().min(1),
  value: marketNumberSchema,
});
export type MarketSizeAnalysis = z.infer<typeof marketSizeAnalysisSchema>;

export const businessModelTypeSchema = z.enum([
  "SUBSCRIPTION",
  "SAAS",
  "LICENSE",
  "TRANSACTION",
  "MARKETPLACE",
  "SERVICE",
  "B2G_CONTRACT",
  "B2B_CONTRACT",
  "HARDWARE_PLUS_SOFTWARE",
  "FREEMIUM",
  "OPEN_CORE",
  "OTHER",
]);
export type BusinessModelType = z.infer<typeof businessModelTypeSchema>;

/** `pricingHypothesis`'s own `marketNumberSchema` rules are what prevent "inventing a market price and labeling it verified." */
export const businessModelEntrySchema = z.object({
  model: businessModelTypeSchema,
  whyItFits: z.string().min(1),
  whoPays: z.string().min(1),
  pricingHypothesis: marketNumberSchema,
  costDriver: z.string().min(1),
  adoptionFriction: z.string().min(1),
  confidence: qualitativeLevelSchema,
});
export type BusinessModelEntry = z.infer<typeof businessModelEntrySchema>;

/**
 * Every field is a required `marketNumberSchema` — "we don't know yet"
 * must be said explicitly (`status: "UNKNOWN"`), never omitted, the same
 * `knownOrUnknownString` philosophy Phase 03 established.
 */
export const unitEconomicsSchema = z.object({
  customerAcquisitionCost: marketNumberSchema,
  revenuePerCustomer: marketNumberSchema,
  grossMargin: marketNumberSchema,
  operationalCost: marketNumberSchema,
  supportCost: marketNumberSchema,
  infrastructureCost: marketNumberSchema,
  paybackPeriod: marketNumberSchema,
  narrative: z.string().min(1),
});
export type UnitEconomics = z.infer<typeof unitEconomicsSchema>;

export const scalabilityLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);
export type ScalabilityLevel = z.infer<typeof scalabilityLevelSchema>;

export const scalabilityAssessmentSchema = z.object({
  level: scalabilityLevelSchema,
  reasoning: z.string().min(1),
});
export type ScalabilityAssessment = z.infer<typeof scalabilityAssessmentSchema>;

/** A fixed set of seven dimensions, always all present — the same "always all seven, never sparse" shape as Phase 03's `researchCoverageSchema`. */
export const scalabilitySchema = z.object({
  technical: scalabilityAssessmentSchema,
  operational: scalabilityAssessmentSchema,
  geographic: scalabilityAssessmentSchema,
  customer: scalabilityAssessmentSchema,
  support: scalabilityAssessmentSchema,
  regulatory: scalabilityAssessmentSchema,
  data: scalabilityAssessmentSchema,
});
export type Scalability = z.infer<typeof scalabilitySchema>;

export const marketRealitySignalSchema = z.enum([
  "STRONG_MARKET_SIGNAL",
  "PROMISING_MARKET_SIGNAL",
  "EARLY_MARKET",
  "NICHE_MARKET",
  "WEAK_MARKET_SIGNAL",
  "INSUFFICIENT_EVIDENCE",
]);
export type MarketRealitySignal = z.infer<typeof marketRealitySignalSchema>;

/** Dynamically generated per run — never a hard-coded boilerplate line. */
export const marketRealityCheckSchema = z.object({
  signal: marketRealitySignalSchema,
  explanation: z.string().min(1),
});
export type MarketRealityCheck = z.infer<typeof marketRealityCheckSchema>;

export const marketScoresSchema = z.object({
  marketPotential: scoreSchema,
  commercialPotential: scoreSchema,
  adoptionPotential: scoreSchema,
  scalability: scoreSchema,
});
export type MarketScores = z.infer<typeof marketScoresSchema>;

/**
 * What the Market Agent produces on its own, before the Investment
 * Agent's assessment exists. `market_evidence`'s source list and
 * `evidence_summary`'s counts are NOT asked of the model here — the
 * phase composer computes both from the pipeline's own bookkeeping
 * (reused Phase 03 sources + this phase's own research), continuing the
 * "no fake numbers" discipline every prior phase composer applies.
 */
export const marketAgentOutputSchema = z.object({
  marketSummary: z.string().min(1),
  customerModel: customerModelSchema.nullable(),
  marketSegments: z.array(marketSegmentEntrySchema).default([]),
  competitiveLandscape: competitiveLandscapeSchema,
  marketDrivers: marketDriversSchema,
  adoptionAnalysis: adoptionAnalysisSchema,
  tamAnalysis: marketSizeAnalysisSchema,
  samAnalysis: marketSizeAnalysisSchema,
  somAnalysis: marketSizeAnalysisSchema,
  businessModels: z.array(businessModelEntrySchema).default([]),
  unitEconomics: unitEconomicsSchema,
  scalability: scalabilitySchema,
  marketRealityCheck: marketRealityCheckSchema,
  marketScores: marketScoresSchema,
  /** Market-side uncertain items — never fabricated answers. */
  validationQuestions: z.array(z.string().min(1)).default([]),
});
export type MarketAgentOutput = z.infer<typeof marketAgentOutputSchema>;

/**
 * A generation-time-constrained variant of `marketAgentOutputSchema`:
 * every `sourceIds` field — on competitor entries and inside every
 * `marketNumberSchema`/claim, including nested calculation inputs — is a
 * real enum of the ids that actually exist for this call, not an open
 * `string[]` the model is merely instructed to respect. See
 * `idRefArraySchema` for why this constrains Gemini's structured output
 * itself. Build fresh per call and parse the result back into the plain
 * `MarketAgentOutput` type; never a substitute for the composer's own
 * post-generation cross-reference check against the same real data.
 */
export function buildDynamicMarketAgentOutputSchema(validSourceIds: readonly string[]) {
  const claimSchema = buildRichEvidenceClaimSchema(validSourceIds);
  const numberSchema = buildMarketNumberSchema(validSourceIds);

  const dynamicCustomerModelSchema = z.object({
    whoExperiencesThePain: claimSchema,
    whoUsesTheSolution: claimSchema,
    whoPays: claimSchema,
    whoApproves: claimSchema,
    whoBenefits: claimSchema,
    roleAssignments: z.array(roleAssignmentSchema).default([]),
  });

  const dynamicCompetitorEntrySchema = z.object({
    name: z.string().min(1),
    organization: z.string().min(1),
    solution: z.string().min(1),
    targetCustomer: z.string().min(1),
    classification: competitorClassificationSchema,
    strength: claimSchema,
    limitation: claimSchema,
    marketPositionIfVerified: claimSchema,
    sourceIds: idRefArraySchema(validSourceIds),
    confidence: qualitativeLevelSchema,
  });

  const dynamicCompetitiveLandscapeSchema = z.object({
    competitors: z.array(dynamicCompetitorEntrySchema).default([]),
    summary: claimSchema,
  });

  const dynamicAdoptionFactorSchema = z.object({
    factor: adoptionFactorKeySchema,
    assessment: claimSchema,
  });

  const dynamicMarketDriversSchema = z.object({
    adoptionDrivers: z.array(claimSchema).default([]),
    adoptionBarriers: z.array(claimSchema).default([]),
  });

  const dynamicMarketSizeAnalysisSchema = z.object({
    definition: z.string().min(1),
    value: numberSchema,
  });

  const dynamicBusinessModelEntrySchema = z.object({
    model: businessModelTypeSchema,
    whyItFits: z.string().min(1),
    whoPays: z.string().min(1),
    pricingHypothesis: numberSchema,
    costDriver: z.string().min(1),
    adoptionFriction: z.string().min(1),
    confidence: qualitativeLevelSchema,
  });

  const dynamicUnitEconomicsSchema = z.object({
    customerAcquisitionCost: numberSchema,
    revenuePerCustomer: numberSchema,
    grossMargin: numberSchema,
    operationalCost: numberSchema,
    supportCost: numberSchema,
    infrastructureCost: numberSchema,
    paybackPeriod: numberSchema,
    narrative: z.string().min(1),
  });

  return z.object({
    marketSummary: z.string().min(1),
    customerModel: dynamicCustomerModelSchema.nullable(),
    marketSegments: z.array(marketSegmentEntrySchema).default([]),
    competitiveLandscape: dynamicCompetitiveLandscapeSchema,
    marketDrivers: dynamicMarketDriversSchema,
    adoptionAnalysis: z.object({
      factors: z.array(dynamicAdoptionFactorSchema).default([]),
      adoptionRisk: adoptionRiskSchema,
      reasoning: z.string().min(1),
    }),
    tamAnalysis: dynamicMarketSizeAnalysisSchema,
    samAnalysis: dynamicMarketSizeAnalysisSchema,
    somAnalysis: dynamicMarketSizeAnalysisSchema,
    businessModels: z.array(dynamicBusinessModelEntrySchema).default([]),
    unitEconomics: dynamicUnitEconomicsSchema,
    scalability: scalabilitySchema,
    marketRealityCheck: marketRealityCheckSchema,
    marketScores: marketScoresSchema,
    validationQuestions: z.array(z.string().min(1)).default([]),
  });
}
