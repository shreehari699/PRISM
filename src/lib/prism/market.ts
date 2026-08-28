import { z } from "zod";

import { idRefArraySchema } from "./id-refs";
import { qualitativeLevelSchema } from "./scoring";

/**
 * A three-way status for a market *figure* specifically — narrower than
 * `EvidenceStatus` (VERIFIED/INFERENCE/ASSUMPTION/RECOMMENDATION/UNKNOWN)
 * because a dollar figure either came from a real source (`VERIFIED`),
 * was calculated from sourced inputs (`MODEL_ESTIMATE`), or genuinely
 * isn't known (`UNKNOWN`) — "inference" and "assumption" don't add a
 * meaningful distinction once a number is involved. This is Phase 06's
 * mandatory anti-fabrication mechanism: TAM/SAM/SOM, revenue, CAC,
 * pricing, and every other market number route through
 * `marketNumberSchema` below, never a bare `z.number()`.
 */
export const marketNumberStatusSchema = z.enum(["VERIFIED", "MODEL_ESTIMATE", "UNKNOWN"]);
export type MarketNumberStatus = z.infer<typeof marketNumberStatusSchema>;

/** One sourced or assumed input to a `MODEL_ESTIMATE` calculation. */
export const modelCalculationInputSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  /** Phase-local source ids this input is grounded in, if any — empty means it's itself an assumption. */
  sourceIds: z.array(z.string().min(1)).default([]),
});
export type ModelCalculationInput = z.infer<typeof modelCalculationInputSchema>;

/**
 * The reproducible working behind a `MODEL_ESTIMATE`: PRISM never shows
 * a calculated number without also showing exactly how it was derived —
 * inputs, the formula applied to them, and every assumption made. A
 * human (or a test) can redo the arithmetic and get the same `result`.
 */
export const modelCalculationSchema = z.object({
  inputs: z.array(modelCalculationInputSchema).min(1),
  formula: z.string().min(1),
  assumptions: z.array(z.string().min(1)).default([]),
});
export type ModelCalculation = z.infer<typeof modelCalculationSchema>;

/**
 * The single primitive every market figure in Phase 06 is expressed
 * through — TAM/SAM/SOM, pricing, unit economics, and more. Its own
 * `superRefine` is what makes "no fabricated market numbers" an
 * enforced invariant rather than a prompt request:
 *
 * - `UNKNOWN` must carry a null value/unit/currency — there is nothing
 *   to show, so nothing is shown.
 * - `VERIFIED` must cite at least one source id and must NOT carry a
 *   `calculation` (a verified figure was read from a source, not
 *   derived — if it needed deriving, it's a `MODEL_ESTIMATE`).
 * - `MODEL_ESTIMATE` must carry a `calculation` (inputs + formula +
 *   assumptions), so the number is always reproducible, never a bare
 *   figure the model asserts from nowhere.
 */
export const marketNumberSchema = z
  .object({
    status: marketNumberStatusSchema,
    value: z.number().nonnegative().nullable(),
    unit: z.string().min(1).nullable(),
    currency: z.string().min(1).nullable(),
    geography: z.string().min(1).nullable(),
    period: z.string().min(1).nullable(),
    sourceIds: z.array(z.string().min(1)).default([]),
    calculation: modelCalculationSchema.nullable().default(null),
    confidence: qualitativeLevelSchema,
    reasoning: z.string().min(1),
  })
  .superRefine((n, ctx) => {
    if (n.status === "UNKNOWN") {
      if (n.value !== null) {
        ctx.addIssue({
          code: "custom",
          message: "An UNKNOWN market number must have a null value.",
          path: ["value"],
        });
      }
      return;
    }

    if (n.value === null) {
      ctx.addIssue({
        code: "custom",
        message: `A ${n.status} market number must have a non-null value.`,
        path: ["value"],
      });
    }

    if (n.status === "VERIFIED") {
      if (n.sourceIds.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "A VERIFIED market number must cite at least one source id.",
          path: ["sourceIds"],
        });
      }
      if (n.calculation !== null) {
        ctx.addIssue({
          code: "custom",
          message:
            "A VERIFIED market number was read from a source, not derived — it must not carry a calculation. Use MODEL_ESTIMATE instead.",
          path: ["calculation"],
        });
      }
    }

    if (n.status === "MODEL_ESTIMATE" && n.calculation === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "A MODEL_ESTIMATE market number must show its calculation (inputs, formula, assumptions) so it is reproducible.",
        path: ["calculation"],
      });
    }
  });
export type MarketNumber = z.infer<typeof marketNumberSchema>;

/**
 * A generation-time-constrained variant of `marketNumberSchema`: every
 * `sourceIds` field (on the number itself and on each calculation input)
 * is a real enum of the ids that actually exist upstream for this call —
 * see `idRefArraySchema` for why this constrains the model's structured
 * output itself, not just the prompt. Build fresh per call; never a
 * substitute for the composer's own post-generation cross-reference
 * check against the same real data.
 */
export function buildMarketNumberSchema(validSourceIds: readonly string[]) {
  const dynamicCalculationInputSchema = z.object({
    label: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
    sourceIds: idRefArraySchema(validSourceIds),
  });

  const dynamicCalculationSchema = z.object({
    inputs: z.array(dynamicCalculationInputSchema).min(1),
    formula: z.string().min(1),
    assumptions: z.array(z.string().min(1)).default([]),
  });

  return z
    .object({
      status: marketNumberStatusSchema,
      value: z.number().nonnegative().nullable(),
      unit: z.string().min(1).nullable(),
      currency: z.string().min(1).nullable(),
      geography: z.string().min(1).nullable(),
      period: z.string().min(1).nullable(),
      sourceIds: idRefArraySchema(validSourceIds),
      calculation: dynamicCalculationSchema.nullable().default(null),
      confidence: qualitativeLevelSchema,
      reasoning: z.string().min(1),
    })
    .superRefine((n, ctx) => {
      if (n.status === "UNKNOWN") {
        if (n.value !== null) {
          ctx.addIssue({
            code: "custom",
            message: "An UNKNOWN market number must have a null value.",
            path: ["value"],
          });
        }
        return;
      }

      if (n.value === null) {
        ctx.addIssue({
          code: "custom",
          message: `A ${n.status} market number must have a non-null value.`,
          path: ["value"],
        });
      }

      if (n.status === "VERIFIED") {
        if (n.sourceIds.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "A VERIFIED market number must cite at least one source id.",
            path: ["sourceIds"],
          });
        }
        if (n.calculation !== null) {
          ctx.addIssue({
            code: "custom",
            message:
              "A VERIFIED market number was read from a source, not derived — it must not carry a calculation. Use MODEL_ESTIMATE instead.",
            path: ["calculation"],
          });
        }
      }

      if (n.status === "MODEL_ESTIMATE" && n.calculation === null) {
        ctx.addIssue({
          code: "custom",
          message:
            "A MODEL_ESTIMATE market number must show its calculation (inputs, formula, assumptions) so it is reproducible.",
          path: ["calculation"],
        });
      }
    });
}

/**
 * A valuation figure is never allowed to be presented as `VERIFIED` —
 * PRISM never states an exact company valuation as fact. It is either
 * an explicitly-labeled illustrative scenario, or unknown.
 */
export const illustrativeValuationStatusSchema = z.enum([
  "ILLUSTRATIVE_MODEL_ESTIMATE",
  "UNKNOWN",
]);
export type IllustrativeValuationStatus = z.infer<typeof illustrativeValuationStatusSchema>;

export const illustrativeValuationScenarioSchema = z
  .object({
    status: illustrativeValuationStatusSchema,
    value: z.number().nonnegative().nullable(),
    currency: z.string().min(1).nullable(),
    calculation: modelCalculationSchema.nullable().default(null),
    reasoning: z.string().min(1),
  })
  .superRefine((n, ctx) => {
    if (n.status === "UNKNOWN") {
      if (n.value !== null) {
        ctx.addIssue({
          code: "custom",
          message: "An UNKNOWN valuation scenario must have a null value.",
          path: ["value"],
        });
      }
      return;
    }

    if (n.value === null) {
      ctx.addIssue({
        code: "custom",
        message: "An ILLUSTRATIVE_MODEL_ESTIMATE valuation scenario must have a non-null value.",
        path: ["value"],
      });
    }
    if (n.calculation === null) {
      ctx.addIssue({
        code: "custom",
        message: "An ILLUSTRATIVE_MODEL_ESTIMATE valuation scenario must show its calculation.",
        path: ["calculation"],
      });
    }
  });
export type IllustrativeValuationScenario = z.infer<
  typeof illustrativeValuationScenarioSchema
>;

/**
 * A generation-time-constrained variant of
 * `illustrativeValuationScenarioSchema`: its `calculation.inputs[].sourceIds`
 * is a real enum of the ids that actually exist upstream for this call —
 * see `idRefArraySchema`. This is the exact latent gap the Investment
 * Agent had: a reachable `sourceIds` path the model was never shown a
 * real vocabulary for.
 */
export function buildIllustrativeValuationScenarioSchema(validSourceIds: readonly string[]) {
  const dynamicCalculationInputSchema = z.object({
    label: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
    sourceIds: idRefArraySchema(validSourceIds),
  });

  const dynamicCalculationSchema = z.object({
    inputs: z.array(dynamicCalculationInputSchema).min(1),
    formula: z.string().min(1),
    assumptions: z.array(z.string().min(1)).default([]),
  });

  return z
    .object({
      status: illustrativeValuationStatusSchema,
      value: z.number().nonnegative().nullable(),
      currency: z.string().min(1).nullable(),
      calculation: dynamicCalculationSchema.nullable().default(null),
      reasoning: z.string().min(1),
    })
    .superRefine((n, ctx) => {
      if (n.status === "UNKNOWN") {
        if (n.value !== null) {
          ctx.addIssue({
            code: "custom",
            message: "An UNKNOWN valuation scenario must have a null value.",
            path: ["value"],
          });
        }
        return;
      }

      if (n.value === null) {
        ctx.addIssue({
          code: "custom",
          message: "An ILLUSTRATIVE_MODEL_ESTIMATE valuation scenario must have a non-null value.",
          path: ["value"],
        });
      }
      if (n.calculation === null) {
        ctx.addIssue({
          code: "custom",
          message: "An ILLUSTRATIVE_MODEL_ESTIMATE valuation scenario must show its calculation.",
          path: ["calculation"],
        });
      }
    });
}
