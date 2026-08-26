import type { PrismPhaseKey } from "@/lib/prism/phases";
import type { PhaseStatus } from "@/lib/prism/status";
import type { ProjectMode } from "@/lib/prism/modes";

/** Minimal view of an analysis_phases row the orchestrator reasons over. */
export interface PhaseState {
  phaseKey: PrismPhaseKey;
  status: PhaseStatus;
  version: number;
  outputData: unknown;
}

export interface ProjectContext {
  mode: ProjectMode;
  problemStatement: string;
  phases: PhaseState[];
  /**
   * Optional: the authenticated user driving this run. Most agents never
   * need it (they only reason over phase output), but a phase whose
   * executor spends a *separately tracked* resource beyond the generic
   * AI-call accounting the phase engine already does — e.g. Phase 03's
   * Tavily research calls — needs it to check/record that resource's own
   * usage (src/lib/usage) itself. Optional so every existing caller and
   * test fixture that never needed this keeps compiling unchanged.
   */
  userId?: string;
}

export interface PhaseGateResult {
  allowed: boolean;
  reason?: string;
}

/** What an agent run needs assembled before it can be invoked. */
export interface PhaseExecutionContext {
  phaseKey: PrismPhaseKey;
  mode: ProjectMode;
  criteria: readonly string[];
  problemStatement: string;
  /** Approved output of every upstream phase, keyed by phase key. */
  upstreamOutputs: Partial<Record<PrismPhaseKey, unknown>>;
  /** See `ProjectContext.userId`. */
  userId?: string;
}
