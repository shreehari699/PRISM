import { z } from "zod";

/**
 * Lifecycle of a single analysis_phases row. Mirrors the DB check
 * constraint in supabase/migrations — keep the two in sync.
 */
export const phaseStatusSchema = z.enum([
  "not_started",
  "pending_input",
  "running",
  "awaiting_approval",
  "approved",
  "needs_regeneration",
  "failed",
]);

export type PhaseStatus = z.infer<typeof phaseStatusSchema>;

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: "Not started",
  pending_input: "Waiting for input",
  running: "Running",
  awaiting_approval: "Awaiting your approval",
  approved: "Approved",
  needs_regeneration: "Needs regeneration",
  failed: "Failed",
};
