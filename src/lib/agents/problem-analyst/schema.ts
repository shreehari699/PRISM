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
const problemAnatomyShape = {
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
};

/**
 * The comment above used to describe this as a prompt-only constraint,
 * "enforced in the system prompt, not the schema." That was a real gap:
 * `evidenceClaimSchema` is shared with phases that *do* have research
 * (where VERIFIED is legitimate), so nothing actually stopped the model
 * from returning `status: "VERIFIED"` here if it ever drifted from its
 * instructions — the claim would validate cleanly and persist as a
 * Phase 01 "fact" with zero real evidence behind it. This walks every
 * evidence-tagged field and rejects the whole output if any of them
 * claims VERIFIED, so a prompt violation becomes a clean `invalid_output`
 * failure (via GeminiProvider's schema check) instead of a silently
 * accepted hallucination.
 */
export const problemAnatomySchema = z.object(problemAnatomyShape).superRefine((anatomy, ctx) => {
  const claims: { path: (string | number)[]; status: string }[] = [
    { path: ["what"], status: anatomy.what.status },
    { path: ["where"], status: anatomy.where.status },
    { path: ["when"], status: anatomy.when.status },
    ...anatomy.why.map((claim, i) => ({ path: ["why", i], status: claim.status })),
    ...anatomy.assumptions.map((claim, i) => ({
      path: ["assumptions", i],
      status: claim.status,
    })),
  ];

  for (const claim of claims) {
    if (claim.status === "VERIFIED") {
      ctx.addIssue({
        code: "custom",
        message:
          "Phase 01 (Problem Intelligence) has no research capability, so no evidence-tagged field may be VERIFIED — use INFERENCE or ASSUMPTION instead.",
        path: [...claim.path, "status"],
      });
    }
  }
});

export type ProblemAnatomy = z.infer<typeof problemAnatomySchema>;
