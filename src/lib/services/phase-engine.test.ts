import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";

import { createMockDb, dbError, noRow, row, rows } from "./test-support/mock-db";

const checkUsageMock = vi.fn();
const recordUsageMock = vi.fn();

vi.mock("@/lib/usage", () => ({
  checkUsage: (...args: unknown[]) => checkUsageMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

const { executePhaseAction, getPhaseState } = await import("./phase-engine");

const now = new Date().toISOString();

const sessionRow = {
  id: "session-1",
  project_id: "project-1",
  problem_statement_id: "ps-1",
  current_phase_key: "problem_intelligence",
  status: "in_progress",
  created_at: now,
  updated_at: now,
};

const projectRow = {
  id: "project-1",
  user_id: "user-1",
  name: "Crop Pricing Transparency",
  mode: "HACKATHON",
  status: "active",
  created_at: now,
  updated_at: now,
};

const problemStatementRow = {
  id: "ps-1",
  project_id: "project-1",
  raw_text: "Smallholder farmers cannot see real-time crop prices before harvest.",
  input_method: "paste",
  source_file_url: null,
  discovery_parameters: null,
  created_at: now,
  updated_at: now,
};

function phaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "phase-1",
    session_id: "session-1",
    project_id: "project-1",
    phase_key: "problem_intelligence",
    status: "not_started",
    version: 1,
    input_data: null,
    output_data: null,
    error_message: null,
    approved_at: null,
    approved_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const validAnatomy = {
  restatement: "Smallholder farmers lack real-time crop pricing.",
  who: [{ group: "Smallholder farmers", description: "Sell crops at harvest." }],
  what: { claim: "x", status: "INFERENCE", reasoning: "y" },
  where: { claim: "x", status: "INFERENCE", reasoning: "y" },
  when: { claim: "x", status: "INFERENCE", reasoning: "y" },
  why: [{ claim: "x", status: "ASSUMPTION", reasoning: "y" }],
  assumptions: [],
  openQuestions: [],
  clarity: { isWellDefined: true, issues: [] },
  problemScore: {
    value: 55,
    basis: "ai_estimate",
    reasoning: "n/a",
    confidence: "medium",
  },
};

function fakeProvider(
  result: Awaited<ReturnType<AiProvider["generateStructured"]>>,
): AiProvider {
  return {
    name: "fake",
    model: "fake-model",
    generateStructured: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  checkUsageMock.mockReset();
  recordUsageMock.mockReset();
  checkUsageMock.mockResolvedValue({
    allowed: true,
    safeMode: false,
    remaining: { daily: 10, monthly: 100 },
  });
  recordUsageMock.mockResolvedValue(undefined);
});

describe("getPhaseState", () => {
  it("reports not_started when no phase row exists yet", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });

    const result = await getPhaseState(supabase, "session-1", "problem_intelligence");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("not_started");
    }
  });

  it("returns the mapped DTO when a phase row exists", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "awaiting_approval" })])],
    });

    const result = await getPhaseState(supabase, "session-1", "problem_intelligence");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("awaiting_approval");
    }
  });

  it("returns not_found for a session that doesn't exist (or isn't owned by this caller)", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    // maybeSingle() with no matching row resolves { data: null, error: null }
    const result = await getPhaseState(supabase, "missing", "problem_intelligence");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

describe("executePhaseAction: invalid input", () => {
  it("rejects an unknown phase key before touching the database", async () => {
    const supabase = createMockDb({});
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "not_a_real_phase" as never,
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_input");
  });
});

describe("executePhaseAction: run", () => {
  it("runs the Problem Analyst for a fresh phase and persists awaiting_approval", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ status: "running" })),
        row(phaseRow({ status: "awaiting_approval", output_data: validAnatomy })),
      ],
    });

    const provider = fakeProvider({
      status: "ok",
      model: "fake-model",
      data: validAnatomy,
      usage: { totalTokens: 321 },
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("awaiting_approval");
      expect(result.data.outputData).toEqual(validAnatomy);
    }
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "ai", 321);
  });

  it("never calls the AI provider once the usage limit is reached", async () => {
    checkUsageMock.mockResolvedValue({
      allowed: false,
      safeMode: true,
      reason: "Daily ai request limit reached (50/day).",
      remaining: { daily: 0, monthly: 10 },
    });

    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({});
    const provider = fakeProvider({ status: "ok", model: "x", data: validAnatomy });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_implemented for a phase with no registered agent, without fabricating output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([phaseRow({ status: "approved" })]), // problem_intelligence approved, unblocking stakeholder_pain
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_implemented");
  });

  it("blocks a phase whose approval-gated upstream phase isn't approved yet", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "awaiting_approval" })])],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
  });

  it("refuses to re-run a phase that already has output, suggesting regenerate instead", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "awaiting_approval" })])],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/regenerate/);
    }
  });

  it("marks the phase failed (not fabricated success) when the model output fails schema validation", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({
      analysis_phases: [row(phaseRow({ status: "running" })), noRow],
    });
    const provider = fakeProvider({
      status: "invalid_output",
      message: "Gemini output failed schema validation",
      raw: "{}",
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/schema validation/);
    }
  });

  it("reports unavailable (not a generic error) when the configured model is unavailable", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({
      analysis_phases: [row(phaseRow({ status: "running" })), noRow],
    });
    const provider = fakeProvider({
      status: "unavailable",
      reason: "Configured model is unavailable",
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
  });
});

describe("executePhaseAction: regenerate", () => {
  it("refuses to regenerate a phase that has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "regenerate",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/use "run" first/);
    }
  });

  it("archives the previous output to history and bumps the version", async () => {
    const priorOutput = { ...validAnatomy, restatement: "old version" };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({ status: "approved", version: 1, output_data: priorOutput }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ status: "running", version: 2 })),
        row(
          phaseRow({
            status: "awaiting_approval",
            version: 2,
            output_data: validAnatomy,
          }),
        ),
      ],
    });
    const provider = fakeProvider({
      status: "ok",
      model: "fake-model",
      data: validAnatomy,
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(2);
      expect(result.data.outputData).toEqual(validAnatomy);
    }
  });
});

describe("executePhaseAction: approve", () => {
  it("refuses to approve a phase that isn't awaiting approval", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "running" })])],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "approve",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("approves an awaiting_approval phase and advances the session pointer", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow), noRow],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([phaseRow({ status: "awaiting_approval", output_data: validAnatomy })]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(
          phaseRow({
            status: "approved",
            output_data: validAnatomy,
            approved_at: now,
            approved_by: "user-1",
          }),
        ),
      ],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "approve",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("approved");
      expect(result.data.approvedAt).toBe(now);
    }
  });
});

describe("executePhaseAction: session not found", () => {
  it("returns not_found when the session doesn't exist or isn't owned by the caller", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "problem_intelligence",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

describe("executePhaseAction: database failure surfaces as a typed error", () => {
  it("propagates a read failure instead of throwing", async () => {
    const supabase = createMockDb({
      analysis_sessions: [dbError("connection reset")],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "problem_intelligence",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/connection reset/);
    }
  });
});
