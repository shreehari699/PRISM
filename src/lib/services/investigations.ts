import "server-only";

import { z } from "zod";

import { intelligenceDossierAnalysisSchema } from "@/lib/phases/intelligence-dossier/schema";
import { PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import { projectModeSchema, type ProjectMode } from "@/lib/prism/modes";
import type { DbClient } from "@/lib/supabase/admin";
import {
  analysisPhaseRowSchema,
  analysisSessionRowSchema,
  problemStatementRowSchema,
  projectRowSchema,
  toPhaseStateDTO,
  type AnalysisSessionRow,
  type PhaseStateDTO,
  type ProblemStatementRow,
  type ProjectRow,
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
 * Ensures the authenticated caller has a `profiles` row before anything
 * that foreign-keys to it (`projects.user_id references profiles (id)`)
 * gets written. Normally unnecessary — `handle_new_user()`
 * (0002_profiles.sql) auto-provisions this on every new `auth.users`
 * insert — but that trigger cannot retroactively backfill an account that
 * existed before it did (e.g. a user who signed up while testing, before
 * migrations were applied to this project). `ignoreDuplicates` makes this
 * a no-op for the overwhelming common case where the profile already
 * exists; it never overwrites an existing row's `full_name`/`organization`.
 * Runs on the caller's own user-scoped client — `profiles_insert_own`
 * (0009_profiles_insert_policy_and_backfill.sql) is what actually allows
 * this, scoped to `id = auth.uid()`, so this can only ever create the
 * caller's own profile, never anyone else's.
 */
async function ensureOwnProfile(
  supabase: DbClient,
  userId: string,
  email: string,
  fullName: string | null,
): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, email, full_name: fullName },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    return fail("error", `Failed to provision user profile: ${error.message}`);
  }
  return ok(true as const);
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
  user: { email: string; fullName: string | null },
): Promise<ServiceResult<CreatedInvestigation>> {
  const profileResult = await ensureOwnProfile(supabase, userId, user.email, user.fullName);
  if (!profileResult.ok) return profileResult;

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

/** One row for the investigation history list — never another user's data, RLS-scoped by the caller's client. */
export interface InvestigationSummary {
  sessionId: string;
  projectId: string;
  projectName: string;
  problemPreview: string;
  mode: ProjectMode;
  sessionStatus: AnalysisSessionRow["status"];
  currentPhaseKey: PrismPhaseKey;
  createdAt: string;
  /** The Phase 10 final decision, once the dossier has run — null before then. */
  latestVerdict: string | null;
}

/**
 * Lists every investigation the caller owns, newest first. Every query
 * runs on the caller's user-scoped client, so RLS — not this function —
 * is what actually prevents one user from seeing another's projects;
 * `userId` here only narrows the query, it is not the security boundary.
 */
export async function listInvestigations(
  supabase: DbClient,
  userId: string,
): Promise<ServiceResult<InvestigationSummary[]>> {
  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (projectsError) {
    return fail("error", `Failed to load investigations: ${projectsError.message}`);
  }
  const projects = (projectRows ?? []).map((row) => projectRowSchema.parse(row));
  if (projects.length === 0) return ok([]);

  const projectIds = projects.map((p) => p.id);

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("analysis_sessions")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });
  if (sessionsError) {
    return fail("error", `Failed to load analysis sessions: ${sessionsError.message}`);
  }
  const sessions = (sessionRows ?? []).map((row) => analysisSessionRowSchema.parse(row));
  if (sessions.length === 0) return ok([]);

  const problemStatementIds = [...new Set(sessions.map((s) => s.problem_statement_id))];
  const { data: psRows, error: psError } = await supabase
    .from("problem_statements")
    .select("*")
    .in("id", problemStatementIds);
  if (psError) {
    return fail("error", `Failed to load problem statements: ${psError.message}`);
  }
  const problemStatements = (psRows ?? []).map((row) => problemStatementRowSchema.parse(row));

  const sessionIds = sessions.map((s) => s.id);
  const { data: dossierRows, error: dossierError } = await supabase
    .from("analysis_phases")
    .select("*")
    .in("session_id", sessionIds)
    .eq("phase_key", "intelligence_dossier");
  if (dossierError) {
    return fail("error", `Failed to load dossier phases: ${dossierError.message}`);
  }
  const dossierPhases = (dossierRows ?? []).map((row) => analysisPhaseRowSchema.parse(row));

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const problemStatementById = new Map(problemStatements.map((p) => [p.id, p]));
  const dossierBySession = new Map(dossierPhases.map((d) => [d.session_id, d]));

  const summaries = sessions.map((session): InvestigationSummary => {
    const project = projectById.get(session.project_id);
    const problemStatement = problemStatementById.get(session.problem_statement_id);
    const dossier = dossierBySession.get(session.id);

    let latestVerdict: string | null = null;
    if (
      dossier &&
      (dossier.status === "approved" || dossier.status === "awaiting_approval") &&
      dossier.output_data
    ) {
      const parsed = intelligenceDossierAnalysisSchema.safeParse(dossier.output_data);
      if (parsed.success) latestVerdict = parsed.data.finalVerdict.decision;
    }

    return {
      sessionId: session.id,
      projectId: session.project_id,
      projectName: project?.name ?? "Untitled investigation",
      problemPreview: problemStatement?.raw_text.slice(0, 200) ?? "",
      mode: project?.mode ?? "STARTUP",
      sessionStatus: session.status,
      currentPhaseKey: session.current_phase_key,
      createdAt: session.created_at,
      latestVerdict,
    };
  });

  return ok(summaries);
}

/** Everything the investigation dashboard needs in one round trip: the project, its problem statement, and all ten phases' current state (missing rows read as `not_started`, exactly like `getPhaseState`). */
export interface SessionOverview {
  project: ProjectRow;
  problemStatement: ProblemStatementRow;
  session: AnalysisSessionRow;
  phases: PhaseStateDTO[];
}

export async function getSessionOverview(
  supabase: DbClient,
  sessionId: string,
): Promise<ServiceResult<SessionOverview>> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from("analysis_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) {
    return fail("error", `Failed to load session: ${sessionError.message}`);
  }
  if (!sessionRow) {
    return fail("not_found", "Analysis session not found.");
  }
  const session = analysisSessionRowSchema.parse(sessionRow);

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", session.project_id)
    .maybeSingle();
  if (projectError || !projectRow) {
    return fail("error", `Failed to load project: ${projectError?.message ?? "not found"}`);
  }
  const project = projectRowSchema.parse(projectRow);

  const { data: psRow, error: psError } = await supabase
    .from("problem_statements")
    .select("*")
    .eq("id", session.problem_statement_id)
    .maybeSingle();
  if (psError || !psRow) {
    return fail("error", `Failed to load problem statement: ${psError?.message ?? "not found"}`);
  }
  const problemStatement = problemStatementRowSchema.parse(psRow);

  const { data: phaseRows, error: phasesError } = await supabase
    .from("analysis_phases")
    .select("*")
    .eq("session_id", sessionId);
  if (phasesError) {
    return fail("error", `Failed to load phases: ${phasesError.message}`);
  }
  const byKey = new Map(
    (phaseRows ?? [])
      .map((row) => analysisPhaseRowSchema.parse(row))
      .map((row) => [row.phase_key, row] as const),
  );

  const phases: PhaseStateDTO[] = PHASE_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return toPhaseStateDTO(existing);
    return {
      phaseKey: key,
      status: "not_started",
      version: 0,
      outputData: null,
      errorMessage: null,
      approvedAt: null,
      updatedAt: session.updated_at,
    };
  });

  return ok({ project, problemStatement, session, phases });
}
