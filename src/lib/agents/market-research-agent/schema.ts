import { z } from "zod";

import type { AiUsage } from "@/lib/ai";
import { researchSourceSchema } from "@/lib/research";

/**
 * What kind of market evidence a query is meant to surface — a
 * different, market-flavored axis than Phase 03's
 * `ResearchQueryCategory` (commercial/startup/government landscape of
 * *existing solutions*). This one targets market size, growth,
 * adoption, and the other market-specific facts Phase 06 needs, and
 * exists precisely so Phase 06 never falls back to a generic
 * catch-all search — every query must target one of these.
 */
export const marketResearchQueryCategorySchema = z.enum([
  "MARKET_SIZE",
  "MARKET_GROWTH",
  "ADOPTION",
  "INDUSTRY_TRENDS",
  "GOVERNMENT_SPENDING",
  "CUSTOMER_BEHAVIOR",
  "TECHNOLOGY_ADOPTION",
  "REGULATORY",
  "DEMAND",
  "GEOGRAPHIC",
]);
export type MarketResearchQueryCategory = z.infer<typeof marketResearchQueryCategorySchema>;

export const marketResearchQueryPlanItemSchema = z.object({
  query: z.string().min(1),
  category: marketResearchQueryCategorySchema,
  /** Why this specific query was chosen, grounded in the actual leading opportunity — not boilerplate. */
  reason: z.string().min(1),
  /** What this query is trying to learn. */
  targetInformation: z.string().min(1),
});
export type MarketResearchQueryPlanItem = z.infer<typeof marketResearchQueryPlanItemSchema>;

/**
 * Deliberately not `.min(1)`: when Phase 05 found no meaningful
 * opportunity, there is nothing legitimate to research, and a hard
 * minimum would push the model toward inventing an irrelevant generic
 * query ("AI startup market") — exactly what this phase forbids.
 */
export const marketQuestionGeneratorOutputSchema = z.object({
  queries: z.array(marketResearchQueryPlanItemSchema).default([]),
});
export type MarketQuestionGeneratorOutput = z.infer<
  typeof marketQuestionGeneratorOutputSchema
>;

/**
 * A `ResearchSource` (the existing, unmodified normalization contract)
 * plus the two things this phase needs for cross-referencing and
 * provenance — the same extension Phase 03's `phaseSourceSchema` makes,
 * just with this phase's own query-category vocabulary.
 */
export const marketPhaseSourceSchema = researchSourceSchema.extend({
  sourceLocalId: z.string().min(1),
  query: z.string().min(1),
  category: marketResearchQueryCategorySchema,
});
export type MarketPhaseSource = z.infer<typeof marketPhaseSourceSchema>;

/**
 * Result of the combined question-generation + Tavily-execution step.
 * Mirrors `ResearchAgentResult` (Phase 03) so the phase composer
 * reasons about both the same way; kept as its own type because the
 * `queries`/`sources` element types differ (market category vocabulary).
 */
export type MarketResearchAgentResult =
  | {
      status: "ok";
      queries: MarketResearchQueryPlanItem[];
      sources: MarketPhaseSource[];
      queriesExecuted: number;
      researchFailures: number;
      budgetExhausted: false;
      usage?: AiUsage;
    }
  | {
      status: "ok";
      queries: [];
      sources: [];
      queriesExecuted: 0;
      researchFailures: 0;
      budgetExhausted: true;
      reason: string;
    }
  | { status: "invalid_output"; message: string; raw: string }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };
