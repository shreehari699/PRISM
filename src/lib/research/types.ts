import { z } from "zod";

export const researchSourceTypeSchema = z.enum([
  "academic",
  "government",
  "industry",
  "startup",
  "commercial",
  "international",
  "open_source",
  "technology",
  "market",
]);

export type ResearchSourceType = z.infer<typeof researchSourceTypeSchema>;

/**
 * The normalized shape every ResearchProvider must return results in,
 * regardless of upstream API. Nothing here is optional-but-fabricatable:
 * a provider that cannot determine a field must omit it, never guess.
 */
export const researchSourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  publisher: z.string().min(1).optional(),
  sourceType: researchSourceTypeSchema,
  publishedDate: z.iso.date().optional(),
  retrievedAt: z.iso.datetime(),
  snippet: z.string().min(1),
  /** Direct quote or data point substantiating relevance, if extractable. */
  evidence: z.string().min(1).optional(),
  /** How relevant this result is to the query — a provider-reported score, not invented. */
  relevance: z.number().min(0).max(1).optional(),
  /** Provider's own confidence in the result's accuracy/currency, if it exposes one. */
  confidence: z.number().min(0).max(1).optional(),
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const researchQuerySchema = z.object({
  query: z.string().min(1),
  categories: z.array(researchSourceTypeSchema).optional(),
  maxResults: z.number().int().positive().max(50).default(10),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;

/**
 * Discriminated union so callers must handle "unavailable" explicitly
 * instead of receiving an empty array indistinguishable from
 * "verified zero results."
 */
export type ResearchResult =
  | { status: "ok"; sources: ResearchSource[]; provider: string }
  | { status: "unavailable"; reason: string; provider: string }
  | { status: "error"; message: string; provider: string };

export interface ResearchProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  search(query: ResearchQuery): Promise<ResearchResult>;
}
