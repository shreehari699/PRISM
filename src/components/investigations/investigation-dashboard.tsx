"use client";

import * as React from "react";

import { PhaseErrorAlert } from "@/components/investigations/phase-error-alert";
import { PhaseRunner } from "@/components/investigations/phase-runner";
import { PhaseStepper } from "@/components/investigations/phase-stepper";
import { isRateLimitedMessage } from "@/lib/prism/error-messages";
import { getPhaseDefinition, nextPhase, PHASE_KEYS, type PrismPhaseKey } from "@/lib/prism/phases";
import { deriveUiPhaseState } from "@/lib/prism/ui-phase-state";
import type { PhaseAction } from "@/lib/services/phase-engine";
import type { AnalysisSessionRow, PhaseStateDTO, ProblemStatementRow, ProjectRow } from "@/lib/supabase/rows";
import { phaseCompleteDialogue, phaseOpenDialogue, welcomeDialogue } from "@/lib/voice/dialogue";
import { describePhaseFindings } from "@/lib/voice/phase-findings";
import {
  hasPhaseOpenNarrationPlayed,
  markPhaseOpenNarrationPlayed,
} from "@/lib/voice/phase-open-narration-store";
import { useVoiceConsultant } from "@/lib/voice/voice-context";
import { hasWelcomeNarrationPlayed, markWelcomeNarrationPlayed } from "@/lib/voice/welcome-narration-store";

/**
 * Every phase action is a single request/response round trip — there's
 * no background job to poll, so this fetch is the only thing standing
 * between the UI and an infinite "Investigating..." spinner if a
 * provider or the network genuinely hangs. The server side already
 * bounds each Gemini call (see gemini-provider.ts), but this is a
 * second, independent backstop: if it fires, the user sees a real,
 * retryable error instead of a frozen page.
 *
 * Must safely exceed Gemini's own worst case: up to 3 attempts at 120s
 * each plus backoff between them (gemini-provider.ts) is ~370s alone,
 * before Supabase/Tavily legs are even counted. 5 minutes used to be
 * comfortable margin before retries existed; it no longer is — a
 * legitimate retry sequence could now exceed it, causing the client to
 * give up and report a false timeout while the server keeps working,
 * which is exactly the "must refresh to see the real result" bug this
 * is meant to prevent. 8 minutes restores real margin.
 */
const PHASE_ACTION_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * When the AI provider itself comes back rate-limited, an immediate
 * Retry just repeats the same 429 a moment later. This keeps the action
 * buttons disabled a short, fixed window past the failure — not a
 * precise provider-supplied delay (that isn't threaded to the client) —
 * just enough to stop a reflexive re-click from hammering an
 * already-rate-limited provider.
 */
const RATE_LIMIT_COOLDOWN_MS = 5000;

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
  const [rateLimitCooldown, setRateLimitCooldown] = React.useState(false);
  const { speak } = useVoiceConsultant();
  const spokenWelcome = React.useRef(false);

  // Re-enables the action buttons automatically once the cooldown window
  // elapses — no user action, no refresh, required.
  React.useEffect(() => {
    if (!rateLimitCooldown) return;
    const timer = setTimeout(() => setRateLimitCooldown(false), RATE_LIMIT_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [rateLimitCooldown]);

  React.useEffect(() => {
    if (spokenWelcome.current) return;
    spokenWelcome.current = true;
    // Welcome narration greets a user starting THIS investigation for
    // the first time — not every time its page happens to (re)mount.
    // Without this check, refreshing an in-progress investigation, or
    // simply navigating back to it, replayed the generic welcome over
    // whatever phase content the user actually had open.
    if (hasWelcomeNarrationPlayed(sessionId)) return;
    markWelcomeNarrationPlayed(sessionId);
    speak(welcomeDialogue(problemStatement.raw_text));
    // Runs once per dashboard mount — deliberately excludes `speak` (stable
    // per-render identity from context, not a dependency the effect needs
    // to react to) so navigating between phases doesn't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, problemStatement.raw_text]);

  const uiStates = React.useMemo(() => {
    const record = {} as Record<PrismPhaseKey, ReturnType<typeof deriveUiPhaseState>>;
    for (const key of PHASE_KEYS) {
      record[key] = deriveUiPhaseState(phases, key);
    }
    return record;
  }, [phases]);

  const selectPhase = React.useCallback(
    (key: PrismPhaseKey) => {
      setSelected(key);
      // Spoken once per phase per investigation — a refresh or navigating
      // back to an already-opened phase must not replay it, mirroring the
      // welcome narration's own once-per-investigation guard above.
      if (!hasPhaseOpenNarrationPlayed(sessionId, key)) {
        markPhaseOpenNarrationPlayed(sessionId, key);
        const def = getPhaseDefinition(key);
        speak(phaseOpenDialogue(def.title, def.description));
      }
    },
    [sessionId, speak],
  );

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHASE_ACTION_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/phases/${phaseKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as PhaseStateDTO | { error?: string } | null;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error ? body.error : "That action couldn't be completed.";
        setError(message);
        if (isRateLimitedMessage(message)) setRateLimitCooldown(true);
        setPending(false);
        return;
      }

      const updated = body as PhaseStateDTO;
      const { staleSiblingPhases, ...updatedPhase } = updated;
      setPhases((prev) => {
        // `run`/`regenerate` can, as a side effect, mark already-completed
        // downstream phases `needs_regeneration` on the server — reflect
        // that here too so the stepper and those phases' views update in
        // the same pass, with no separate refetch or refresh required.
        const staleKeys = new Set((staleSiblingPhases ?? []).map((p) => p.phaseKey));
        const withoutStale = prev.filter((p) => p.phaseKey !== phaseKey && !staleKeys.has(p.phaseKey));
        return [...withoutStale, updatedPhase, ...(staleSiblingPhases ?? [])];
      });
      setPending(false);

      if (action === "run" || action === "regenerate") {
        if (updated.status === "awaiting_approval") {
          const title = getPhaseDefinition(phaseKey).title;
          speak(phaseCompleteDialogue(title, describePhaseFindings(phaseKey, updated.outputData)));
        }
      }

      if (action === "approve") {
        const next = nextPhase(phaseKey);
        if (next) {
          selectPhase(next.key);
        }
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? "This is taking far longer than expected and may have stalled. Select this phase again to check its latest status, or retry."
          : "A network error stopped that action from completing. Please try again.",
      );
      setPending(false);
    } finally {
      clearTimeout(timeout);
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

      {error ? <PhaseErrorAlert message={error} /> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <PhaseStepper states={uiStates} selected={selected} onSelect={selectPhase} />
        </aside>

        <div>
          <PhaseRunner
            phase={selectedPhase}
            dto={selectedDto}
            uiState={uiStates[selected]}
            pending={pending || rateLimitCooldown}
            onRun={() => performAction(selected, "run")}
            onApprove={() => performAction(selected, "approve")}
            onRegenerate={() => performAction(selected, "regenerate")}
          />
        </div>
      </div>
    </div>
  );
}
