import { z } from "zod";

import type { AiUsage } from "@/lib/ai";
import { researchSourceSchema } from "@/lib/research/types";

/**
 * What kind of existing-solution landscape a query is meant to surface.
 * Deliberately a different, finer-grained axis than
 * `ResearchSourceType` (src/lib/research/types.ts, which classifies a
 * source's *publisher domain* — academic/government/industry/etc. — for
 * the research abstraction generally). This one classifies *why this
 * phase asked the question* (commercial landscape vs. government
 * programs vs. open-source projects...), which only makes sense in the
 * context of "what already exists for this problem." Reusing
 * `ResearchSourceType` here instead would conflate two different
 * concerns and wasn't what either taxonomy was designed for.
 */
export const researchQueryCategorySchema = z.enum([
  "COMMERCIAL",
  "STARTUP",
  "GOVERNMENT",
  "ACADEMIC",
  "OPEN_SOURCE",
  "INTERNATIONAL",
  "TECHNOLOGY",
  "WORKFLOW",
  "ALTERNATIVE",
]);

export type ResearchQueryCategory = z.infer<typeof researchQueryCategorySchema>;

export const researchQueryPlanItemSchema = z.object({
  query: z.string().min(1),
  category: researchQueryCategorySchema,
  /** Why this specific query was chosen, grounded in the actual problem/stakeholders — not boilerplate. */
  reason: z.string().min(1),
  /** What this query is trying to learn. */
  targetInformation: z.string().min(1),
});

export type ResearchQueryPlanItem = z.infer<typeof researchQueryPlanItemSchema>;

export const questionGeneratorOutputSchema = z.object({
  queries: z.array(researchQueryPlanItemSchema).min(1),
});

export type QuestionGeneratorOutput = z.infer<typeof questionGeneratorOutputSchema>;

/**
 * A `ResearchSource` (the existing, unmodified normalization contract
 * from src/lib/research/types.ts) plus the two things this phase needs
 * for cross-referencing and provenance: a local slug other Phase 03
 * output can point to, and which query actually produced it. Extending
 * rather than replacing `researchSourceSchema` keeps this phase on the
 * one existing research abstraction instead of inventing a second one.
 */
export const phaseSourceSchema = researchSourceSchema.extend({
  sourceLocalId: z.string().min(1),
  query: z.string().min(1),
  category: researchQueryCategorySchema,
});

export type PhaseSource = z.infer<typeof phaseSourceSchema>;

/**
 * Result of the combined question-generation + Tavily-execution step.
 * Not a plain `AiResult` because this step is only partly an AI call —
 * mirrors the same ok/unavailable/invalid_output/error vocabulary so
 * callers reason about it the same way.
 */
export type ResearchAgentResult =
  | {
      status: "ok";
      queries: ResearchQueryPlanItem[];
      sources: PhaseSource[];
      queriesExecuted: number;
      researchFailures: number;
      budgetExhausted: false;
      /** Token usage from the question-generation Gemini call, for the phase composer to combine with its own agent calls. */
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
  | { status: "error"; message: string }
  | { status: "rate_limited"; message: string; retryAfterMs?: number };
