import { z } from "zod";

import { projectModeSchema } from "@/lib/prism/modes";
import { PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import { phaseStatusSchema } from "@/lib/prism/status";

/**
 * Zod schemas mirroring the columns of `database.types.ts`'s not-yet-real
 * tables (see the placeholder comment there). Every read from
 * `createUntypedClient`/`createUntypedAdminClient` should be parsed
 * through one of these rather than trusted as `any` — the boundary
 * where an unknown DB row becomes a typed domain value.
 */

const phaseKeyEnum = z.enum(PHASE_KEYS as [PrismPhaseKey, ...PrismPhaseKey[]]);

export const projectRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  mode: projectModeSchema,
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProjectRow = z.infer<typeof projectRowSchema>;

export const problemStatementRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  raw_text: z.string(),
  input_method: z.enum(["paste", "pdf_upload", "idea", "discovery"]),
  source_file_url: z.string().nullable(),
  discovery_parameters: z.unknown().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProblemStatementRow = z.infer<typeof problemStatementRowSchema>;

export const analysisSessionRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  problem_statement_id: z.string(),
  current_phase_key: phaseKeyEnum,
  status: z.enum(["in_progress", "completed", "abandoned"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AnalysisSessionRow = z.infer<typeof analysisSessionRowSchema>;

export const analysisPhaseRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  project_id: z.string(),
  phase_key: phaseKeyEnum,
  status: phaseStatusSchema,
  version: z.number().int().positive(),
  input_data: z.unknown().nullable(),
  output_data: z.unknown().nullable(),
  error_message: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AnalysisPhaseRow = z.infer<typeof analysisPhaseRowSchema>;

/** Domain-shaped (camelCase) view of an analysis_phases row for the UI/API layer. */
export interface PhaseStateDTO {
  phaseKey: AnalysisPhaseRow["phase_key"];
  status: AnalysisPhaseRow["status"];
  version: number;
  outputData: unknown;
  errorMessage: string | null;
  approvedAt: string | null;
  updatedAt: string;
}

export function toPhaseStateDTO(row: AnalysisPhaseRow): PhaseStateDTO {
  return {
    phaseKey: row.phase_key,
    status: row.status,
    version: row.version,
    outputData: row.output_data,
    errorMessage: row.error_message,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
  };
}
