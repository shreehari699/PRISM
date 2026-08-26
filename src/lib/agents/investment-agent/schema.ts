import { z } from "zod";

import { confidenceLevelSchema } from "@/lib/prism/confidence";
import { illustrativeValuationScenarioSchema } from "@/lib/prism/market";
import { qualitativeLevelSchema, scoreSchema } from "@/lib/prism/scoring";

export const capitalIntensityLevelSchema = z.enum(["LOW", "MODERATE", "HIGH", "VERY_HIGH"]);
export type CapitalIntensityLevel = z.infer<typeof capitalIntensityLevelSchema>;

export const fundingStageSchema = z.enum(["BOOTSTRAPPED", "PRE_SEED", "SEED", "GROWTH"]);
export type FundingStage = z.infer<typeof fundingStageSchema>;

/**
 * Never a single "you need ₹X crore" figure — the spec explicitly
 * forbids that unless backed by a transparent model, and no such model
 * exists for an unbuilt product. `capitalIntensity` and
 * `fundingStageRecommendation` are qualitative bands with reasoning
 * instead, same discipline as `scalabilityLevelSchema`.
 */
export const investmentAnalysisSchema = z.object({
  capitalIntensity: capitalIntensityLevelSchema,
  capitalIntensityReasoning: z.string().min(1),
  initialDevelopmentRequirements: z.array(z.string().min(1)).default([]),
  infrastructureRequirements: z.array(z.string().min(1)).default([]),
  teamRequirements: z.array(z.string().min(1)).default([]),
  operationalRequirements: z.array(z.string().min(1)).default([]),
  deploymentRequirements: z.array(z.string().min(1)).default([]),
  fundingStageRecommendation: fundingStageSchema,
  fundingStageReasoning: z.string().min(1),
});
export type InvestmentAnalysis = z.infer<typeof investmentAnalysisSchema>;

export const valuationDriverKeySchema = z.enum([
  "REVENUE_POTENTIAL",
  "MARKET_SIZE",
  "GROWTH",
  "RECURRING_REVENUE",
  "TECHNOLOGY_DEFENSIBILITY",
  "COMPETITION",
  "CAPITAL_INTENSITY",
  "REGULATORY_RISK",
  "TRACTION_REQUIREMENTS",
]);
export type ValuationDriverKey = z.infer<typeof valuationDriverKeySchema>;

export const valuationDriverEntrySchema = z.object({
  driver: valuationDriverKeySchema,
  assessment: qualitativeLevelSchema,
  reasoning: z.string().min(1),
});
export type ValuationDriverEntry = z.infer<typeof valuationDriverEntrySchema>;

/**
 * `illustrativeScenario` is `null` when no scenario is worth showing —
 * its own schema (`illustrativeValuationScenarioSchema`) mechanically
 * forbids a `VERIFIED` status, so PRISM can never present an exact
 * valuation as verified fact, only ever an explicitly labeled
 * illustrative estimate or UNKNOWN.
 */
export const valuationDriversOutputSchema = z.object({
  drivers: z.array(valuationDriverEntrySchema).default([]),
  illustrativeScenario: illustrativeValuationScenarioSchema.nullable(),
});
export type ValuationDriversOutput = z.infer<typeof valuationDriversOutputSchema>;

export const investmentRealitySignalSchema = z.enum([
  "STRONG_INVESTMENT_CASE",
  "PROMISING_INVESTMENT_CASE",
  "BOOTSTRAP_FIRST",
  "RESEARCH_BEFORE_INVESTMENT",
  "WEAK_INVESTMENT_CASE",
  "INSUFFICIENT_EVIDENCE",
]);
export type InvestmentRealitySignal = z.infer<typeof investmentRealitySignalSchema>;

/** "Do not seek investment yet" (BOOTSTRAP_FIRST/WEAK_INVESTMENT_CASE/etc.) is a valid, honest PRISM outcome, not a failure to avoid. */
export const investmentRealityCheckSchema = z.object({
  signal: investmentRealitySignalSchema,
  explanation: z.string().min(1),
});
export type InvestmentRealityCheck = z.infer<typeof investmentRealityCheckSchema>;

export const investmentScoresSchema = z.object({
  investmentReadiness: scoreSchema,
});
export type InvestmentScores = z.infer<typeof investmentScoresSchema>;

/**
 * What the Investment Agent produces, given the Market Agent's already-
 * validated output as input. `consultantMessage` here is the final one
 * persisted for the whole phase — it sees the complete market AND
 * investment picture, so it supersedes the Market Agent's own framing
 * rather than being merged with it, the same "last agent's message wins"
 * precedent Phase 02/04/05 already establish for their own composers.
 */
export const investmentAgentOutputSchema = z.object({
  investmentAnalysis: investmentAnalysisSchema,
  valuationDrivers: valuationDriversOutputSchema,
  investmentRealityCheck: investmentRealityCheckSchema,
  investmentScores: investmentScoresSchema,
  /** The final phase-wide confidence roundup — it sees both the market and investment picture, so it's produced here rather than by the Market Agent. */
  confidenceSummary: z.object({
    overallConfidence: confidenceLevelSchema,
    narrative: z.string().min(1),
  }),
  /** Investment-side uncertain items — merged with the Market Agent's by the phase composer. */
  validationQuestions: z.array(z.string().min(1)).default([]),
  consultantMessage: z.string().min(1),
});
export type InvestmentAgentOutput = z.infer<typeof investmentAgentOutputSchema>;
