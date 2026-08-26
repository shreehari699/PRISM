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
}
