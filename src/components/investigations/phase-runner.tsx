"use client";

import { Check, Lock, RotateCcw, Sparkles } from "lucide-react";

import { InvestigatingIndicator } from "@/components/investigations/investigating-indicator";
import { PhaseErrorAlert } from "@/components/investigations/phase-error-alert";
import { PhaseOutput } from "@/components/investigations/phase-output";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PrismPhaseDefinition } from "@/lib/prism/phases";
import type { UiPhaseState } from "@/lib/prism/ui-phase-state";
import type { PhaseStateDTO } from "@/lib/supabase/rows";

export function PhaseRunner({
  phase,
  dto,
  uiState,
  pending,
  onRun,
  onApprove,
  onRegenerate,
}: {
  phase: PrismPhaseDefinition;
  dto: PhaseStateDTO;
  uiState: UiPhaseState;
  pending: boolean;
  onRun: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Phase {String(phase.order).padStart(2, "0")} of 10</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{phase.title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{phase.description}</p>
      </div>

      {uiState === "locked" ? (
        <Alert>
          <Lock />
          <AlertDescription>
            Complete and approve the earlier phases to unlock this one.
          </AlertDescription>
        </Alert>
      ) : null}

      {uiState === "ready" || uiState === "not_started" || uiState === "pending_input" ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-8">
          <p className="text-sm text-muted-foreground">This phase hasn&apos;t run yet.</p>
          <Button variant="prism" onClick={onRun} disabled={pending}>
            <Sparkles />
            Run this phase
          </Button>
        </div>
      ) : null}

      {uiState === "running" ? (
        <InvestigatingIndicator label={`Investigating: ${phase.title}`} />
      ) : null}

      {uiState === "failed" ? (
        <>
          <PhaseErrorAlert message={dto.errorMessage} />
          <div>
            <Button variant="prism" onClick={onRun} disabled={pending}>
              Retry
            </Button>
          </div>
        </>
      ) : null}

      {uiState === "needs_regeneration" ? (
        <Alert variant="warning">
          <RotateCcw />
          <AlertTitle>This phase is stale</AlertTitle>
          <AlertDescription>
            An earlier phase changed since this one last ran. Regenerate it to use the latest
            evidence — the output below is from its previous run.
          </AlertDescription>
        </Alert>
      ) : null}

      {(uiState === "awaiting_approval" || uiState === "approved" || uiState === "needs_regeneration") &&
      dto.outputData ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            {uiState === "approved" ? (
              <Badge variant="verified">
                <Check className="size-3" />
                Approved
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={pending}>
              <RotateCcw />
              Regenerate
            </Button>
            {uiState === "awaiting_approval" ? (
              <Button size="sm" variant="prism" onClick={onApprove} disabled={pending}>
                <Check />
                Approve &amp; continue
              </Button>
            ) : null}
          </div>

          <div className="rounded-lg border border-border p-5">
            <PhaseOutput phaseKey={phase.key} value={dto.outputData} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
