import {
  getPhaseDefinition,
  PHASE_KEYS,
  upstreamPhasesOf,
  downstreamPhasesOf,
  type PrismPhaseKey,
} from "@/lib/prism/phases";
import { MODE_CRITERIA } from "@/lib/prism/modes";

import { getAgentsForPhase, type AgentDefinition } from "./agents";
import type {
  PhaseExecutionContext,
  PhaseGateResult,
  PhaseState,
  ProjectContext,
} from "./types";

/**
 * The central PRISM Orchestrator. It holds no AI or database logic of its
 * own — it only answers the sequencing questions that keep the ten
 * phases honest: what's active, what's allowed to run next, what needs
 * re-approval when something upstream changes. Callers (API routes /
 * server actions) use its answers to decide what to actually execute.
 */
export class PrismOrchestrator {
  constructor(private readonly context: ProjectContext) {}

  private stateOf(key: PrismPhaseKey): PhaseState | undefined {
    return this.context.phases.find((p) => p.phaseKey === key);
  }

  /**
   * The first phase that is not yet "approved" — the terminal status for
   * a phase either way: a human explicitly approves gated phases, and
   * the system auto-marks non-gated phases approved once their agent
   * completes. Either way, "approved" is what makes a phase's output
   * safe to feed into the next one.
   */
  getActivePhase(): PrismPhaseKey {
    for (const key of PHASE_KEYS) {
      const state = this.stateOf(key);
      if (!state || state.status !== "approved") return key;
    }
    return PHASE_KEYS[PHASE_KEYS.length - 1];
  }

  /**
   * Whether `key` may run right now: every upstream phase that requires
   * approval must already be approved. Non-gated upstream phases only
   * need to have produced output (any non-failed, non-empty status).
   */
  canEnterPhase(key: PrismPhaseKey): PhaseGateResult {
    for (const upstreamKey of upstreamPhasesOf(key)) {
      const upstreamDef = getPhaseDefinition(upstreamKey);
      const upstreamState = this.stateOf(upstreamKey);

      if (!upstreamState || upstreamState.status === "not_started") {
        return {
          allowed: false,
          reason: `"${upstreamDef.title}" has not been run yet.`,
        };
      }

      if (upstreamState.status === "failed") {
        return {
          allowed: false,
          reason: `"${upstreamDef.title}" failed and must be retried.`,
        };
      }

      if (upstreamDef.requiresApproval && upstreamState.status !== "approved") {
        return {
          allowed: false,
          reason: `"${upstreamDef.title}" is awaiting your approval before later phases can use it.`,
        };
      }
    }

    return { allowed: true };
  }

  requiresApproval(key: PrismPhaseKey): boolean {
    return getPhaseDefinition(key).requiresApproval;
  }

  getRequiredAgents(key: PrismPhaseKey): AgentDefinition[] {
    return getAgentsForPhase(key);
  }

  /**
   * When a phase's approved output changes (edited or regenerated),
   * every downstream phase that already ran is now built on stale
   * input. Returns the phase keys that must be flagged
   * `needs_regeneration` — callers apply that status transition.
   */
  getPhasesRequiringRegeneration(changedPhase: PrismPhaseKey): PrismPhaseKey[] {
    return downstreamPhasesOf(changedPhase).filter((key) => {
      const state = this.stateOf(key);
      return (
        state !== undefined &&
        state.status !== "not_started" &&
        state.status !== "pending_input"
      );
    });
  }

  /** Assembles everything a phase's agent(s) need to run. */
  buildExecutionContext(key: PrismPhaseKey): PhaseExecutionContext {
    const upstreamOutputs: Partial<Record<PrismPhaseKey, unknown>> = {};

    for (const upstreamKey of upstreamPhasesOf(key)) {
      const state = this.stateOf(upstreamKey);
      if (state?.outputData !== undefined) {
        upstreamOutputs[upstreamKey] = state.outputData;
      }
    }

    return {
      phaseKey: key,
      mode: this.context.mode,
      criteria: MODE_CRITERIA[this.context.mode],
      problemStatement: this.context.problemStatement,
      upstreamOutputs,
      userId: this.context.userId,
    };
  }
}
