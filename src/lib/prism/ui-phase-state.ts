import { PRISM_PHASES, type PrismPhaseKey } from "@/lib/prism/phases";
import type { PhaseStatus } from "@/lib/prism/status";
import type { PhaseStateDTO } from "@/lib/supabase/rows";

/**
 * UI-only gating hint layered on top of the real `PhaseStatus` values.
 * "locked" never comes from the database — it's derived here purely so
 * the stepper can show a phase as not-yet-actionable. The phase engine
 * (`PrismOrchestrator.canEnterPhase`) is the actual authority on whether
 * a run is allowed; this only has to be a reasonable UI approximation of
 * that same sequential-approval rule, since the API rejects any attempt
 * that doesn't actually satisfy it.
 */
export type UiPhaseState = PhaseStatus | "locked" | "ready";

export function deriveUiPhaseState(
  phases: readonly PhaseStateDTO[],
  phaseKey: PrismPhaseKey,
): UiPhaseState {
  const byKey = new Map(phases.map((p) => [p.phaseKey, p]));
  const phase = PRISM_PHASES.find((p) => p.key === phaseKey);
  if (!phase) return "not_started";

  const state = byKey.get(phaseKey);
  if (state && state.status !== "not_started") return state.status;

  if (phase.order === 1) return "ready";

  const upstream = PRISM_PHASES.filter((p) => p.order < phase.order);
  const blocked = upstream.some((up) => {
    const upState = byKey.get(up.key);
    if (!upState || upState.status === "not_started" || upState.status === "failed") return true;
    if (up.requiresApproval && upState.status !== "approved") return true;
    return false;
  });

  return blocked ? "locked" : "ready";
}

export const UI_PHASE_STATE_LABELS: Record<UiPhaseState, string> = {
  locked: "Locked",
  ready: "Ready to run",
  not_started: "Not started",
  pending_input: "Waiting for input",
  running: "Investigating…",
  awaiting_approval: "Awaiting your review",
  approved: "Approved",
  needs_regeneration: "Needs regeneration",
  failed: "Failed",
};
