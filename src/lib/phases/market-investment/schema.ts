import { z } from "zod";

import {
  adoptionAnalysisSchema,
  businessModelEntrySchema,
  businessModelTypeSchema,
  competitiveLandscapeSchema,
  customerModelSchema,
  marketDriversSchema,
  marketRealityCheckSchema,
  marketScoresSchema,
  marketSegmentEntrySchema,
  marketSizeAnalysisSchema,
  scalabilitySchema,
  unitEconomicsSchema,
} from "@/lib/agents/market-agent/schema";
import {
  investmentAnalysisSchema,
  investmentRealityCheckSchema,
  investmentScoresSchema,
  valuationDriversOutputSchema,
} from "@/lib/agents/investment-agent/schema";
import { confidenceLevelSchema } from "@/lib/prism/confidence";
import { marketNumberSchema } from "@/lib/prism/market";
import { researchSourceTypeSchema } from "@/lib/research";

/**
 * One evidence source backing this phase's market claims — either
 * reused from Phase 03's existing-solution research or newly researched
 * here. Reusing Phase 03 sources (rather than re-researching the same
 * ground) is what "source reuse" means in practice: this is a plain
 * projection of whichever source object it came from, not a new
 * research abstraction.
 */
export const marketEvidenceSourceSchema = z.object({
  sourceLocalId: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  sourceType: researchSourceTypeSchema,
  retrievedAt: z.iso.datetime(),
  snippet: z.string().min(1),
  origin: z.enum(["existing_solutions_reused", "market_research"]),
});
export type MarketEvidenceSource = z.infer<typeof marketEvidenceSourceSchema>;

/**
 * `PARTIAL_MARKET_EVIDENCE` — set by the composer, never asked of a
 * model — whenever this run's own research hit the usage budget, a
 * query failure, or otherwise came back thin. It is an honest label,
 * not a defect: the rest of the phase's numbers may still legitimately
 * be UNKNOWN as a result.
 */
export const marketEvidenceStatusSchema = z.enum(["COMPLETE", "PARTIAL_MARKET_EVIDENCE"]);
export type MarketEvidenceStatus = z.infer<typeof marketEvidenceStatusSchema>;

export const marketEvidenceSchema = z.object({
  sources: z.array(marketEvidenceSourceSchema).default([]),
  status: marketEvidenceStatusSchema,
  narrative: z.string().min(1),
});
export type MarketEvidence = z.infer<typeof marketEvidenceSchema>;

/** A thin, composer-derived projection of each business model's own pricing hypothesis — not re-asked of the model. */
export const pricingHypothesisEntrySchema = z.object({
  model: businessModelTypeSchema,
  pricingHypothesis: marketNumberSchema,
});
export type PricingHypothesisEntry = z.infer<typeof pricingHypothesisEntrySchema>;

/**
 * Phase 06's persisted output. Every field down to `marketRealityCheck`
 * comes from the Market Agent; `investmentAnalysis` onward (except
 * `investmentScores`/`confidenceSummary`, also investment-side) comes
 * from the Investment Agent; `marketEvidence`, `pricingHypotheses`, and
 * `evidenceSummary` are computed by the phase composer from the
 * pipeline's own bookkeeping, never asked of either model — the same
 * "no fake numbers" discipline every prior phase composer applies.
 */
export const marketInvestmentAnalysisSchema = z.object({
  marketSummary: z.string().min(1),
  customerModel: customerModelSchema.nullable(),
  marketSegments: z.array(marketSegmentEntrySchema).default([]),
  competitiveLandscape: competitiveLandscapeSchema,
  marketDrivers: marketDriversSchema,
  adoptionAnalysis: adoptionAnalysisSchema,
  marketEvidence: marketEvidenceSchema,
  tamAnalysis: marketSizeAnalysisSchema,
  samAnalysis: marketSizeAnalysisSchema,
  somAnalysis: marketSizeAnalysisSchema,
  businessModels: z.array(businessModelEntrySchema).default([]),
  pricingHypotheses: z.array(pricingHypothesisEntrySchema).default([]),
  unitEconomics: unitEconomicsSchema,
  scalability: scalabilitySchema,
  investmentAnalysis: investmentAnalysisSchema,
  valuationDrivers: valuationDriversOutputSchema,
  marketRealityCheck: marketRealityCheckSchema,
  investmentRealityCheck: investmentRealityCheckSchema,
  marketScores: marketScoresSchema,
  investmentScores: investmentScoresSchema,
  evidenceSummary: z.object({
    totalSourcesReferenced: z.number().int().nonnegative(),
    verifiedNumbersCount: z.number().int().nonnegative(),
    modelEstimateNumbersCount: z.number().int().nonnegative(),
    unknownNumbersCount: z.number().int().nonnegative(),
    narrative: z.string().min(1),
  }),
  confidenceSummary: z.object({
    overallConfidence: confidenceLevelSchema,
    narrative: z.string().min(1),
  }),
  /** Merged and deduplicated from both agents' own uncertain items. */
  validationQuestions: z.array(z.string().min(1)).default([]),
  consultantMessage: z.string().min(1),
});
export type MarketInvestmentAnalysis = z.infer<typeof marketInvestmentAnalysisSchema>;
