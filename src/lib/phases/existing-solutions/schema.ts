import { z } from "zod";

import { existingSolutionSchema } from "@/lib/agents/existing-solution-agent/schema";
import { phaseSourceSchema, researchQueryPlanItemSchema } from "@/lib/agents/research-agent/schema";

/**
 * The seven categories the master research-coverage report asks for —
 * a deliberately narrower list than the nine query categories
 * (`researchQueryCategorySchema`): WORKFLOW and ALTERNATIVE queries
 * still contribute sources to `stats`, they just don't get their own
 * coverage line, matching the spec's own explicit 7-line coverage list.
 */
export const coverageLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]);
export type CoverageLevel = z.infer<typeof coverageLevelSchema>;

export const researchCoverageSchema = z.object({
  commercial: coverageLevelSchema,
  government: coverageLevelSchema,
  academic: coverageLevelSchema,
  startup: coverageLevelSchema,
  openSource: coverageLevelSchema,
  international: coverageLevelSchema,
  technology: coverageLevelSchema,
});
export type ResearchCoverage = z.infer<typeof researchCoverageSchema>;

/**
 * Every field here is a plain count or boolean computed deterministically
 * by the phase composer from the pipeline's own bookkeeping — never
 * asked of or estimated by the model. This is the mechanism that makes
 * "no fake numbers" actually true rather than just a prompt instruction:
 * there is no code path where the LLM's opinion becomes one of these
 * numbers.
 */
export const researchStatsSchema = z.object({
  sourcesFound: z.number().int().nonnegative(),
  sourcesUsed: z.number().int().nonnegative(),
  solutionsIdentified: z.number().int().nonnegative(),
  queriesExecuted: z.number().int().nonnegative(),
  researchFailures: z.number().int().nonnegative(),
  budgetExhausted: z.boolean(),
});
export type ResearchStats = z.infer<typeof researchStatsSchema>;

export const existingSolutionsAnalysisSchema = z.object({
  queries: z.array(researchQueryPlanItemSchema).default([]),
  sources: z.array(phaseSourceSchema).default([]),
  /** Deliberately not `.min(1)` — zero credible existing solutions is a legitimate finding. */
  solutions: z.array(existingSolutionSchema).default([]),
  researchCoverage: researchCoverageSchema,
  stats: researchStatsSchema,
  consultantMessage: z.string().min(1),
});

export type ExistingSolutionsAnalysis = z.infer<typeof existingSolutionsAnalysisSchema>;
