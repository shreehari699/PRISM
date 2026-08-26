import { z } from "zod";

import { evidenceClaimSchema } from "@/lib/prism/evidence";
import { scoreSchema } from "@/lib/prism/scoring";

/**
 * Output of the Problem Analyst — Phase 01, Problem Intelligence.
 *
 * The Problem Analyst never has research available (see agents.ts —
 * `usesResearch: false`), so nothing it produces can honestly be
 * `VERIFIED`: every `evidenceClaimSchema` field here is expected to
 * carry `INFERENCE` or `ASSUMPTION`, never `VERIFIED` — that's enforced
 * in the system prompt, not the schema (Zod can't check "did you have a
 * real source"), so `runProblemAnalyst`'s tests hold the model's output
 * to that constraint after the fact.
 */
export const problemAnatomySchema = z.object({
  /** A clear, structured restatement of the problem in the analyst's own words. */
  restatement: z.string().min(1),

  who: z
    .array(
      z.object({
        group: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),

  /** What actually happens — the mechanism/manifestation of the problem. */
  what: evidenceClaimSchema,

  /** Where the problem occurs — context, geography, environment. */
  where: evidenceClaimSchema,

  /** When/how often it occurs — frequency, timing, triggers. */
  when: evidenceClaimSchema,

  /** Root causes — why the problem persists. At least one, each independently reasoned. */
  why: z.array(evidenceClaimSchema).min(1),

  /** Explicit premises the analyst had to adopt absent evidence. */
  assumptions: z.array(evidenceClaimSchema).default([]),

  /** Questions that must be resolved by later phases (e.g. stakeholder input) before this analysis can be trusted further. */
  openQuestions: z.array(z.string().min(1)).default([]),

  clarity: z.object({
    isWellDefined: z.boolean(),
    /** Specific ambiguities or gaps in the original problem statement, if any. */
    issues: z.array(z.string().min(1)).default([]),
  }),

  /** How significant and well-defined the problem appears at this stage — an early estimate, revisited once pain/evidence phases run. */
  problemScore: scoreSchema,
});

export type ProblemAnatomy = z.infer<typeof problemAnatomySchema>;
