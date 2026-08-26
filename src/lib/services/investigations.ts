import "server-only";

import { z } from "zod";

import type { DbClient } from "@/lib/supabase/admin";
import { projectModeSchema } from "@/lib/prism/modes";
import {
  analysisSessionRowSchema,
  problemStatementRowSchema,
  projectRowSchema,
} from "@/lib/supabase/rows";

import { fail, ok, type ServiceResult } from "./result";

export const createInvestigationInputSchema = z.object({
  name: z.string().min(1, "Project name is required.").max(200),
  mode: projectModeSchema,
  rawText: z
    .string()
    .min(20, "Problem statement must be at least 20 characters.")
    .max(20_000),
  inputMethod: z.enum(["paste", "pdf_upload", "idea", "discovery"]),
  sourceFileUrl: z.url().optional(),
});

export type CreateInvestigationInput = z.infer<
  typeof createInvestigationInputSchema
>;

export interface CreatedInvestigation {
  projectId: string;
  problemStatementId: string;
  sessionId: string;
}

/**
 * Creates a project, its initial problem statement, and the analysis
 * session that will drive it through the ten PRISM phases. Every insert
 * runs on the caller's user-scoped client (not the admin client) —
 * `projects`, `problem_statements`, and `analysis_sessions` are
 * user-writable tables by design (see SECURITY.md), and Row Level
 * Security is what actually confirms `userId` may write these rows, not
 * this function's own logic.
 */
export async function createInvestigation(
  supabase: DbClient,
  userId: string,
  input: CreateInvestigationInput,
): Promise<ServiceResult<CreatedInvestigation>> {
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: input.name, mode: input.mode })
    .select()
    .maybeSingle();

  if (projectError || !projectRow) {
    return fail("error", `Failed to create project: ${projectError?.message}`);
  }
  const project = projectRowSchema.parse(projectRow);

  const { data: problemStatementRow, error: problemStatementError } =
    await supabase
      .from("problem_statements")
      .insert({
        project_id: project.id,
        raw_text: input.rawText,
        input_method: input.inputMethod,
        source_file_url: input.sourceFileUrl ?? null,
      })
      .select()
      .maybeSingle();

  if (problemStatementError || !problemStatementRow) {
    return fail(
      "error",
      `Failed to create problem statement: ${problemStatementError?.message}`,
    );
  }
  const problemStatement = problemStatementRowSchema.parse(problemStatementRow);

  const { data: sessionRow, error: sessionError } = await supabase
    .from("analysis_sessions")
    .insert({
      project_id: project.id,
      problem_statement_id: problemStatement.id,
      current_phase_key: "problem_intelligence",
      status: "in_progress",
    })
    .select()
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return fail(
      "error",
      `Failed to start analysis session: ${sessionError?.message}`,
    );
  }
  const session = analysisSessionRowSchema.parse(sessionRow);

  return ok({
    projectId: project.id,
    problemStatementId: problemStatement.id,
    sessionId: session.id,
  });
}
