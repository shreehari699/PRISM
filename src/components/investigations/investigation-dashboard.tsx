"use client";

import * as React from "react";

import { PhaseRunner } from "@/components/investigations/phase-runner";
import { PhaseStepper } from "@/components/investigations/phase-stepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPhaseDefinition, nextPhase, PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import { deriveUiPhaseState } from "@/lib/prism/ui-phase-state";
import type { PhaseAction } from "@/lib/services/phase-engine";
import type { AnalysisSessionRow, PhaseStateDTO, ProblemStatementRow, ProjectRow } from "@/lib/supabase/rows";
import { discoveryDialogue, phaseTransitionDialogue, welcomeDialogue } from "@/lib/voice/dialogue";
import { useVoiceConsultant } from "@/lib/voice/voice-context";

export function InvestigationDashboard({
  sessionId,
  project,
  problemStatement,
  session,
  initialPhases,
}: {
  sessionId: string;
  project: ProjectRow;
  problemStatement: ProblemStatementRow;
  session: AnalysisSessionRow;
  initialPhases: PhaseStateDTO[];
}) {
  const [phases, setPhases] = React.useState<PhaseStateDTO[]>(initialPhases);
  const [selected, setSelected] = React.useState<PrismPhaseKey>(session.current_phase_key);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { speak } = useVoiceConsultant();
  const spokenWelcome = React.useRef(false);

  React.useEffect(() => {
    if (spokenWelcome.current) return;
    spokenWelcome.current = true;
    speak(welcomeDialogue(problemStatement.raw_text));
    // Runs once per dashboard mount — deliberately excludes `speak` (stable
    // per-render identity from context, not a dependency the effect needs
    // to react to) so navigating between phases doesn't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemStatement.raw_text]);

  const uiStates = React.useMemo(() => {
    const record = {} as Record<PrismPhaseKey, ReturnType<typeof deriveUiPhaseState>>;
    for (const key of PHASE_KEYS) {
      record[key] = deriveUiPhaseState(phases, key);
    }
    return record;
  }, [phases]);

  const selectedDto: PhaseStateDTO =
    phases.find((p) => p.phaseKey === selected) ?? {
      phaseKey: selected,
      status: "not_started",
      version: 0,
      outputData: null,
      errorMessage: null,
      approvedAt: null,
      updatedAt: session.updated_at,
    };

  async function performAction(phaseKey: PrismPhaseKey, action: PhaseAction) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/phases/${phaseKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json().catch(() => null)) as PhaseStateDTO | { error?: string } | null;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error ? body.error : "That action couldn't be completed.";
        setError(message);
        setPending(false);
        return;
      }

      const updated = body as PhaseStateDTO;
      setPhases((prev) => {
        const withoutThis = prev.filter((p) => p.phaseKey !== phaseKey);
        return [...withoutThis, updated];
      });
      setPending(false);

      if (action === "run" || action === "regenerate") {
        if (updated.status === "awaiting_approval") {
          speak(discoveryDialogue(`${getPhaseDefinition(phaseKey).title} is ready for your review`));
        }
      }

      if (action === "approve") {
        const next = nextPhase(phaseKey);
        if (next) {
          setSelected(next.key);
          speak(phaseTransitionDialogue(next.order, next.title));
        }
      }
    } catch {
      setError("A network error stopped that action from completing. Please try again.");
      setPending(false);
    }
  }

  const selectedPhase = getPhaseDefinition(selected);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {problemStatement.raw_text.slice(0, 240)}
          {problemStatement.raw_text.length > 240 ? "…" : ""}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <PhaseStepper states={uiStates} selected={selected} onSelect={setSelected} />
        </aside>

        <div>
          <PhaseRunner
            phase={selectedPhase}
            dto={selectedDto}
            uiState={uiStates[selected]}
            pending={pending}
            onRun={() => performAction(selected, "run")}
            onApprove={() => performAction(selected, "approve")}
            onRegenerate={() => performAction(selected, "regenerate")}
          />
        </div>
      </div>
    </div>
  );
}
