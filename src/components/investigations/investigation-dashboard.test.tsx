// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvestigationDashboard } from "./investigation-dashboard";
import { VoiceConsultantProvider } from "@/lib/voice/voice-context";
import type {
  AnalysisSessionRow,
  PhaseStateDTO,
  ProblemStatementRow,
  ProjectRow,
} from "@/lib/supabase/rows";

const now = new Date().toISOString();

const project: ProjectRow = {
  id: "project-1",
  user_id: "user-1",
  name: "Urban Flood Intelligence System",
  mode: "HACKATHON",
  status: "active",
  created_at: now,
  updated_at: now,
};

const problemStatement: ProblemStatementRow = {
  id: "ps-1",
  project_id: "project-1",
  raw_text: "Manage urban flooding with real-time data.",
  input_method: "paste",
  source_file_url: null,
  discovery_parameters: null,
  created_at: now,
  updated_at: now,
};

const session: AnalysisSessionRow = {
  id: "session-1",
  project_id: "project-1",
  problem_statement_id: "ps-1",
  current_phase_key: "problem_intelligence",
  status: "in_progress",
  created_at: now,
  updated_at: now,
};

const initialPhases: PhaseStateDTO[] = [];

function renderDashboard() {
  return render(
    <VoiceConsultantProvider>
      <InvestigationDashboard
        sessionId="session-1"
        project={project}
        problemStatement={problemStatement}
        session={session}
        initialPhases={initialPhases}
      />
    </VoiceConsultantProvider>,
  );
}

describe("InvestigationDashboard: phase action timeout safety", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("shows a retryable error instead of spinning forever when a phase action hangs past its bounded timeout", async () => {
    vi.useFakeTimers();

    // Simulates a genuinely hung request: the fetch promise never settles
    // on its own, only in reaction to the AbortController the dashboard
    // wires up — exactly what would happen if a provider call server-side
    // hung with no timeout of its own.
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    renderDashboard();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /run this phase/i }));
    });

    // 5 minutes — PHASE_ACTION_TIMEOUT_MS in investigation-dashboard.tsx.
    // The async variant flushes the microtasks the abort → catch → setState
    // chain needs, so the alert is on screen synchronously afterward —
    // real-timer-based `findBy*` polling would otherwise never observe it
    // while fake timers are active.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/taking far longer than expected/i);
  }, 15_000);

  it("still completes normally well within the timeout window", async () => {
    const updated: PhaseStateDTO = {
      phaseKey: "problem_intelligence",
      status: "awaiting_approval",
      version: 1,
      outputData: { restatement: "ok" },
      errorMessage: null,
      approvedAt: null,
      updatedAt: now,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updated,
    }) as unknown as typeof fetch;

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /run this phase/i }));

    expect(await screen.findByText(/approve & continue/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
