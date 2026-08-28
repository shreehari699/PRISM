import { z } from "zod";

/**
 * An array of ids that must each come from a real, known list — built
 * fresh for every `generateStructured` call from that call's actual
 * upstream data. Zod's JSON Schema conversion turns `z.enum(...)` into a
 * real `enum: [...]` constraint in the schema handed to the model, which
 * Gemini's structured output honors during generation: an id outside the
 * list becomes something the model cannot emit, not just something a
 * prompt instructs it not to. Never a substitute for a composer's own
 * post-generation cross-reference check against the same real data — a
 * model that doesn't fully honor its own schema, or a provider that
 * doesn't enforce `enum`, is still caught there.
 *
 * An empty known-id list forces the field to stay empty (`.max(0)`)
 * rather than `z.enum([])`, which Zod rejects at schema-build time —
 * there is nothing valid to cite, so nothing should be accepted.
 */
export function idRefArraySchema(knownIds: readonly string[]) {
  return knownIds.length > 0
    ? z.array(z.enum(knownIds as [string, ...string[]])).default([])
    : z.array(z.string()).max(0).default([]);
}

/**
 * A single required id that must come from a real, known list — the
 * scalar counterpart to `idRefArraySchema`, for fields like a `gapId` or
 * `opportunityId` reference rather than an array of citations.
 */
export function idRefSchema(knownIds: readonly string[]) {
  return knownIds.length > 0 ? z.enum(knownIds as [string, ...string[]]) : z.never();
}

/**
 * The nullable counterpart to `idRefSchema`, for fields like
 * `redTeamSelection.biggest*RiskValidationId` that may legitimately be
 * null when no real id qualifies.
 */
export function nullableIdRefSchema(knownIds: readonly string[]) {
  return knownIds.length > 0 ? z.enum(knownIds as [string, ...string[]]).nullable() : z.null();
}
