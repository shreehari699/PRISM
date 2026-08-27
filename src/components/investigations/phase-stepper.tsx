"use client";

import { AlertTriangle, Check, Loader2, Lock, RotateCcw } from "lucide-react";
import type React from "react";

import { PRISM_PHASES, type PrismPhaseKey } from "@/lib/prism/phases";
import type { UiPhaseState } from "@/lib/prism/ui-phase-state";
import { cn } from "@/lib/utils";

const ICON_BY_STATE: Record<UiPhaseState, React.ComponentType<{ className?: string }> | null> = {
  locked: Lock,
  ready: null,
  not_started: null,
  pending_input: null,
  running: Loader2,
  awaiting_approval: null,
  approved: Check,
  needs_regeneration: RotateCcw,
  failed: AlertTriangle,
};

function dotClasses(state: UiPhaseState): string {
  switch (state) {
    case "approved":
      return "border-success bg-success text-background";
    case "running":
      return "border-prism bg-prism/10 text-prism";
    case "awaiting_approval":
      return "border-prism text-prism";
    case "failed":
      return "border-destructive bg-destructive/10 text-destructive";
    case "needs_regeneration":
      return "border-warning bg-warning/10 text-warning";
    case "locked":
      return "border-border text-muted-foreground/50";
    default:
      return "border-border text-muted-foreground";
  }
}

export function PhaseStepper({
  states,
  selected,
  onSelect,
}: {
  states: Record<PrismPhaseKey, UiPhaseState>;
  selected: PrismPhaseKey;
  onSelect: (key: PrismPhaseKey) => void;
}) {
  return (
    <ol className="flex flex-col gap-1" aria-label="Investigation phases">
      {PRISM_PHASES.map((phase) => {
        const state = states[phase.key];
        const Icon = ICON_BY_STATE[state];
        const isSelected = phase.key === selected;
        const isLocked = state === "locked";

        return (
          <li key={phase.key}>
            <button
              type="button"
              onClick={() => onSelect(phase.key)}
              aria-current={isSelected ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                isSelected ? "bg-accent" : "hover:bg-accent/50",
                isLocked && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
                  dotClasses(state),
                )}
                aria-hidden="true"
              >
                {Icon ? (
                  <Icon className={cn("size-3.5", state === "running" && "animate-spin")} />
                ) : (
                  String(phase.order).padStart(2, "0")
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-medium", isLocked && "text-muted-foreground")}>
                  {phase.shortTitle}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
