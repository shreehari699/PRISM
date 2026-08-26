import "server-only";

import { getAiProvider, type AiProvider } from "@/lib/ai";
import { PrismOrchestrator } from "@/lib/orchestrator/orchestrator";
import type { PhaseState } from "@/lib/orchestrator/types";
import { getPhaseExecutor } from "@/lib/phases/registry";
import { PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import type { DbClient } from "@/lib/supabase/admin";
import {
  analysisPhaseRowSchema,
  analysisSessionRowSchema,
  problemStatementRowSchema,
  projectRowSchema,
  toPhaseStateDTO,
  type AnalysisPhaseRow,
  type PhaseStateDTO,
} from "@/lib/supabase/rows";
import { checkUsage, recordUsage } from "@/lib/usage";

import { fail, ok, type ServiceResult } from "./result";

export type PhaseAction = "run" | "approve" | "regenerate";

interface PhaseEngineParams {
  /** User-scoped client — every read goes through this so RLS decides what's visible. */
  supabase: DbClient;
  /** Service-role client — used only for the writes SECURITY.md documents as service-role-only. */
  admin: DbClient;
  userId: string;
  sessionId: string;
  phaseKey: PrismPhaseKey;
  action: PhaseAction;
  /** Test-only override; production callers never pass this. */
  aiProvider?: AiProvider;
}

function rowToPhaseState(row: AnalysisPhaseRow): PhaseState {
  return {
    phaseKey: row.phase_key,
    status: row.status,
    version: row.version,
    outputData: row.output_data,
  };
}

interface FetchedContext {
  project: ReturnType<typeof projectRowSchema.parse>;
  problemStatement: ReturnType<typeof problemStatementRowSchema.parse>;
  session: ReturnType<typeof analysisSessionRowSchema.parse>;
  phases: AnalysisPhaseRow[];
}

/**
 * Loads everything needed to reason about one session's phases. Every
 * query runs on the user-scoped client, so a session/project the caller
 * doesn't own simply doesn't come back — RLS makes "not found" and "not
 * yours" indistinguishable on purpose, rather than this function trying
 * to tell them apart and leak which one it is.
 */
async function fetchContext(
  supabase: DbClient,
  sessionId: string,
): Promise<ServiceResult<FetchedContext>> {
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
    return fail(
      "error",
      `Failed to load project: ${projectError?.message ?? "not found"}`,
    );
  }
  const project = projectRowSchema.parse(projectRow);

  const { data: psRow, error: psError } = await supabase
    .from("problem_statements")
    .select("*")
    .eq("id", session.problem_statement_id)
    .maybeSingle();

  if (psError || !psRow) {
    return fail(
      "error",
      `Failed to load problem statement: ${psError?.message ?? "not found"}`,
    );
  }
  const problemStatement = problemStatementRowSchema.parse(psRow);

  const { data: phaseRows, error: phasesError } = await supabase
    .from("analysis_phases")
    .select("*")
    .eq("session_id", sessionId);

  if (phasesError) {
    return fail("error", `Failed to load phases: ${phasesError.message}`);
  }
  const phases = (phaseRows ?? []).map((row) => analysisPhaseRowSchema.parse(row));

  return ok({ project, problemStatement, session, phases });
}

/** Read-only phase state, for the GET endpoint. A phase with no row yet reads as `not_started`. */
export async function getPhaseState(
  supabase: DbClient,
  sessionId: string,
  phaseKey: PrismPhaseKey,
): Promise<ServiceResult<PhaseStateDTO>> {
  const context = await fetchContext(supabase, sessionId);
  if (!context.ok) return context;

  const existing = context.data.phases.find((p) => p.phase_key === phaseKey);
  if (existing) return ok(toPhaseStateDTO(existing));

  return ok({
    phaseKey,
    status: "not_started",
    version: 0,
    outputData: null,
    errorMessage: null,
    approvedAt: null,
    updatedAt: context.data.session.updated_at,
  });
}

async function upsertRunningPhase(
  admin: DbClient,
  params: {
    existingId: string | undefined;
    sessionId: string;
    projectId: string;
    phaseKey: PrismPhaseKey;
    version: number;
  },
): Promise<ServiceResult<AnalysisPhaseRow>> {
  if (params.existingId) {
    const { data, error } = await admin
      .from("analysis_phases")
      .update({ status: "running", version: params.version, error_message: null })
      .eq("id", params.existingId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return fail("error", `Failed to update phase: ${error?.message}`);
    }
    return ok(analysisPhaseRowSchema.parse(data));
  }

  const { data, error } = await admin
    .from("analysis_phases")
    .insert({
      session_id: params.sessionId,
      project_id: params.projectId,
      phase_key: params.phaseKey,
      status: "running",
      version: params.version,
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    return fail("error", `Failed to create phase: ${error?.message}`);
  }
  return ok(analysisPhaseRowSchema.parse(data));
}

/**
 * Runs or re-runs a phase's agent(s) and persists the outcome.
 * `analysis_phases` is read-only to the owning user and writable only by
 * the service role (see SECURITY.md), so every write here goes through
 * `admin` — but only after `fetchContext` proved, via the user-scoped
 * client, that this caller owns the session in the first place.
 */
async function runOrRegenerate(
  params: PhaseEngineParams,
  context: FetchedContext,
  isRegenerate: boolean,
): Promise<ServiceResult<PhaseStateDTO>> {
  const existing = context.phases.find((p) => p.phase_key === params.phaseKey);

  if (isRegenerate) {
    if (!existing) {
      return fail(
        "conflict",
        `Phase "${params.phaseKey}" has never run — use "run" first.`,
      );
    }
    if (existing.status === "running") {
      return fail("conflict", `Phase "${params.phaseKey}" is already running.`);
    }
  } else if (
    existing &&
    (["running", "awaiting_approval", "approved"] as const).includes(
      existing.status as "running" | "awaiting_approval" | "approved",
    )
  ) {
    return fail(
      "conflict",
      `Phase "${params.phaseKey}" already has output — use "regenerate" to redo it.`,
    );
  }

  const orchestrator = new PrismOrchestrator({
    mode: context.project.mode,
    problemStatement: context.problemStatement.raw_text,
    phases: context.phases.map(rowToPhaseState),
  });

  const gate = orchestrator.canEnterPhase(params.phaseKey);
  if (!gate.allowed) {
    return fail("conflict", gate.reason ?? "This phase is not ready to run yet.");
  }

  const executor = getPhaseExecutor(params.phaseKey);
  if (!executor) {
    return fail(
      "not_implemented",
      `The agent for phase "${params.phaseKey}" has not been implemented yet.`,
    );
  }

  const usage = await checkUsage(params.userId, "ai");
  if (!usage.allowed) {
    return fail("unavailable", usage.reason ?? "AI usage limit reached.");
  }

  if (isRegenerate && existing && existing.output_data !== null) {
    const { error: historyError } = await params.admin
      .from("analysis_phase_history")
      .insert({
        phase_id: existing.id,
        project_id: context.project.id,
        version: existing.version,
        output_data: existing.output_data,
        superseded_reason: "regeneration_requested",
      });

    if (historyError) {
      return fail(
        "error",
        `Failed to archive previous phase output: ${historyError.message}`,
      );
    }
  }

  const nextVersion = existing ? existing.version + 1 : 1;

  const runningPhase = await upsertRunningPhase(params.admin, {
    existingId: existing?.id,
    sessionId: params.sessionId,
    projectId: context.project.id,
    phaseKey: params.phaseKey,
    version: nextVersion,
  });
  if (!runningPhase.ok) return runningPhase;

  const executionContext = orchestrator.buildExecutionContext(params.phaseKey);
  const provider = params.aiProvider ?? getAiProvider();
  const result = await executor.execute(executionContext, provider);

  const tokensUsed = result.status === "ok" ? (result.usage?.totalTokens ?? 0) : 0;
  await recordUsage(params.userId, "ai", tokensUsed);

  if (result.status === "ok") {
    const { data: updatedRow, error: updateError } = await params.admin
      .from("analysis_phases")
      .update({
        status: "awaiting_approval",
        output_data: result.data,
        error_message: null,
      })
      .eq("id", runningPhase.data.id)
      .select()
      .maybeSingle();

    if (updateError || !updatedRow) {
      return fail(
        "error",
        `Phase ran successfully but failed to persist: ${updateError?.message}`,
      );
    }

    const stalePhaseKeys = orchestrator.getPhasesRequiringRegeneration(
      params.phaseKey,
    );
    if (stalePhaseKeys.length > 0) {
      await params.admin
        .from("analysis_phases")
        .update({ status: "needs_regeneration" })
        .eq("session_id", params.sessionId)
        .in("phase_key", stalePhaseKeys);
    }

    return ok(toPhaseStateDTO(analysisPhaseRowSchema.parse(updatedRow)));
  }

  const message =
    result.status === "unavailable"
      ? result.reason
      : result.status === "invalid_output"
        ? result.message
        : result.message;
  const code = result.status === "unavailable" ? "unavailable" : "error";

  await params.admin
    .from("analysis_phases")
    .update({ status: "failed", error_message: message })
    .eq("id", runningPhase.data.id);

  return fail(code, message);
}

async function approvePhase(
  params: PhaseEngineParams,
  context: FetchedContext,
): Promise<ServiceResult<PhaseStateDTO>> {
  const existing = context.phases.find((p) => p.phase_key === params.phaseKey);

  if (!existing || existing.status !== "awaiting_approval") {
    return fail(
      "conflict",
      `Phase "${params.phaseKey}" is not awaiting approval.`,
    );
  }

  const approvedAt = new Date().toISOString();

  const { data: updatedRow, error } = await params.admin
    .from("analysis_phases")
    .update({ status: "approved", approved_at: approvedAt, approved_by: params.userId })
    .eq("id", existing.id)
    .select()
    .maybeSingle();

  if (error || !updatedRow) {
    return fail("error", `Failed to approve phase: ${error?.message}`);
  }
  const approvedRow = analysisPhaseRowSchema.parse(updatedRow);

  const updatedPhases = context.phases.map((p) =>
    p.id === approvedRow.id ? approvedRow : p,
  );
  const orchestrator = new PrismOrchestrator({
    mode: context.project.mode,
    problemStatement: context.problemStatement.raw_text,
    phases: updatedPhases.map(rowToPhaseState),
  });
  const nextActivePhase = orchestrator.getActivePhase();

  // analysis_sessions is user-writable (see SECURITY.md) — RLS lets this
  // succeed because `supabase` is the same authenticated client that
  // already proved ownership of this session in fetchContext.
  const { error: sessionUpdateError } = await params.supabase
    .from("analysis_sessions")
    .update({ current_phase_key: nextActivePhase })
    .eq("id", params.sessionId);

  if (sessionUpdateError) {
    return fail(
      "error",
      `Phase approved but failed to advance the session: ${sessionUpdateError.message}`,
    );
  }

  return ok(toPhaseStateDTO(approvedRow));
}

export async function executePhaseAction(
  params: PhaseEngineParams,
): Promise<ServiceResult<PhaseStateDTO>> {
  if (!PHASE_KEYS.includes(params.phaseKey)) {
    return fail("invalid_input", `Unknown phase key: ${params.phaseKey}`);
  }

  const context = await fetchContext(params.supabase, params.sessionId);
  if (!context.ok) return context;

  switch (params.action) {
    case "approve":
      return approvePhase(params, context.data);
    case "run":
      return runOrRegenerate(params, context.data, false);
    case "regenerate":
      return runOrRegenerate(params, context.data, true);
    default: {
      const exhaustive: never = params.action;
      return fail("invalid_input", `Unknown action: ${exhaustive}`);
    }
  }
}
