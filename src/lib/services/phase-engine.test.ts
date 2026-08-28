import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProvider } from "@/lib/ai/types";
import type { ResearchResult } from "@/lib/research";

import { createMockDb, dbError, noRow, row, rows } from "./test-support/mock-db";

const checkUsageMock = vi.fn();
const recordUsageMock = vi.fn();

vi.mock("@/lib/usage", () => ({
  checkUsage: (...args: unknown[]) => checkUsageMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

/**
 * Phase 03's registry entry always resolves its own research provider
 * via `getResearchProvider()` (the phase engine has no way to inject one
 * through the generic `PhaseExecutor` interface, by design — see
 * ARCHITECTURE.md §2c). Mocking it here keeps these tests from needing
 * real Tavily env vars or touching the network, while still exercising
 * the real registry wiring end-to-end. Every response configured below
 * is a legitimate `ResearchResult` value (including "unavailable") —
 * never a fabricated success.
 */
const researchSearchMock = vi.fn();

vi.mock("@/lib/research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/research")>();
  return {
    ...actual,
    getResearchProvider: () => ({
      name: "mock",
      isConfigured: true,
      search: (...args: unknown[]) => researchSearchMock(...args),
    }),
  };
});

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

/** For phases like stakeholder_pain whose executor calls the provider more than once. */
function sequenceProvider(
  results: Awaited<ReturnType<AiProvider["generateStructured"]>>[],
): AiProvider {
  const generateStructured = vi.fn();
  for (const result of results) {
    generateStructured.mockResolvedValueOnce(result);
  }
  return { name: "fake", model: "fake-model", generateStructured };
}

const validStakeholderOutput = {
  stakeholders: [
    {
      localId: "farmer",
      name: "Smallholder farmer",
      category: "PRIMARY",
      roles: ["USER"],
      relationshipToProblem: { claim: "x", status: "INFERENCE", reasoning: "y" },
      context: "ctx",
      needs: [],
      decisionPower: "none",
      influence: "low",
      urgency: "high",
      impact: "high",
      evidenceClaims: [],
      confidence: "medium",
    },
  ],
};

const validPainOutput = {
  painPoints: [
    {
      localId: "pain-1",
      stakeholderLocalId: "farmer",
      painTitle: "No price visibility",
      description: "d",
      cause: { claim: "x", status: "INFERENCE", reasoning: "y" },
      frequency: { claim: "x", status: "UNKNOWN", reasoning: "y" },
      riskIfUnsolved: { claim: "x", status: "ASSUMPTION", reasoning: "y" },
      severityScore: {
        dimensions: {
          severity: 70,
          frequency: 50,
          reach: 40,
          consequence: 60,
          urgency: 55,
          currentSolutionSatisfaction: 20,
        },
        overall: { value: 58, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      },
      confidence: "medium",
    },
  ],
  primaryPain: { painLocalId: "pain-1", reasoning: "Root cause, not a symptom." },
  secondaryPains: [],
  downstreamConsequences: [],
  customerDistinction: { applicable: false, notes: [] },
  validationQuestions: ["How frequently does this occur?"],
  realityCheck: {
    stakeholderConfidence: "MODERATE",
    painConfidence: "MODERATE",
    primaryPainConfidence: "MODERATE",
    evidenceCompleteness: "WEAK",
    summary: "n/a",
  },
  consultantMessage: "The pain looks real but frequency is still unknown.",
};

const mergedStakeholderPainOutput = {
  stakeholders: [
    { ...validStakeholderOutput.stakeholders[0], painPointIds: ["pain-1"] },
  ],
  ...validPainOutput,
};

beforeEach(() => {
  checkUsageMock.mockReset();
  recordUsageMock.mockReset();
  checkUsageMock.mockResolvedValue({
    allowed: true,
    safeMode: false,
    remaining: { daily: 10, monthly: 100 },
  });
  recordUsageMock.mockResolvedValue(undefined);

  researchSearchMock.mockReset();
  researchSearchMock.mockResolvedValue({
    status: "unavailable",
    reason: "no default configured for this test",
    provider: "mock",
  } satisfies ResearchResult);
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

  // The "not_implemented for a phase with no registered agent" example
  // test that lived here through Phases 01-09 has been retired: Phase 10
  // (intelligence_dossier) is the last phase in the catalog, and it is
  // now registered — there is no remaining phase key for this scenario
  // to legitimately target. `registry.test.ts`'s own
  // "returns undefined for every not-yet-implemented phase" test still
  // guards the underlying registry behavior; it simply has nothing left
  // to iterate over now that every phase is implemented.

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

describe("executePhaseAction: concurrent run-start race safety", () => {
  it("turns a database unique-constraint violation on the first insert into a typed conflict, not a raw database error or a duplicate row", async () => {
    // Two near-simultaneous "run" requests for a phase that has never run
    // both pass the in-memory conflict check before either has written a
    // row — the `unique (session_id, phase_key)` constraint is what
    // actually stops the loser's INSERT. This proves that failure
    // surfaces as a friendly, retryable "conflict", not an opaque 500.
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({
      analysis_phases: [
        dbError(
          'duplicate key value violates unique constraint "analysis_phases_session_id_phase_key_key"',
          "23505",
        ),
      ],
    });
    const provider = fakeProvider({ status: "ok", model: "fake-model", data: validAnatomy });

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
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/already running/i);
    }
    // The race is caught before the agent ever runs — no doubled AI spend.
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("treats a no-op conditional update (another request already flipped it to running) as a conflict, not a silent second execution", async () => {
    // A failed phase being retried, or an approved one being regenerated,
    // updates an *existing* row instead of inserting — the unique
    // constraint can't help there. The atomic `.neq("status", "running")`
    // guard is what stops a second concurrent request from also flipping
    // it to running and re-running the agent a second time.
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "failed" })])],
    });
    const admin = createMockDb({
      // The conditional UPDATE's WHERE clause matched zero rows because a
      // concurrent request already won the race and set status="running".
      analysis_phases: [noRow],
    });
    const provider = fakeProvider({ status: "ok", model: "fake-model", data: validAnatomy });

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
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/already running/i);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
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

describe("executePhaseAction: stakeholder_pain (Phase 02) depends on an approved Phase 01", () => {
  it("blocks Phase 02 when Phase 01 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 02 when Phase 01 is awaiting approval (unapproved)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([phaseRow({ status: "awaiting_approval", output_data: validAnatomy })]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 02 when Phase 01 is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            status: "needs_regeneration",
            output_data: validAnatomy,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 02 when Phase 01 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([phaseRow({ status: "failed" })])],
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
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 02 successfully once Phase 01 is approved, charging exactly one AI request", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([phaseRow({ status: "approved", output_data: validAnatomy })]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ phase_key: "stakeholder_pain", status: "running" })),
        row(
          phaseRow({
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            output_data: mergedStakeholderPainOutput,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validStakeholderOutput, usage: { totalTokens: 100 } },
      { status: "ok", model: "fake-model", data: validPainOutput, usage: { totalTokens: 200 } },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("awaiting_approval");
      expect(result.data.outputData).toEqual(mergedStakeholderPainOutput);
    }
    expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    expect(checkUsageMock).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "ai", 300);
  });

  it("marks Phase 02 failed (not fabricated) when the second agent call returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([phaseRow({ status: "approved", output_data: validAnatomy })]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ phase_key: "stakeholder_pain", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validStakeholderOutput },
      { status: "invalid_output", message: "Pain Analyst output failed schema validation", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/schema validation/);
    }
  });

  it("never spends an AI call once the usage limit is reached, even for a two-agent phase", async () => {
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
      analysis_phases: [
        rows([phaseRow({ status: "approved", output_data: validAnatomy })]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([
      { status: "ok", model: "x", data: validStakeholderOutput },
      { status: "ok", model: "x", data: validPainOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own, same as any other phase", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "stakeholder_pain",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerating an approved Phase 01 flags an already-approved Phase 02 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            version: 1,
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            version: 1,
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-1", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-1",
            status: "awaiting_approval",
            version: 2,
            output_data: { ...validAnatomy, restatement: "updated" },
          }),
        ),
        noRow, // the bulk update marking stakeholder_pain needs_regeneration
      ],
    });
    const provider = fakeProvider({
      status: "ok",
      model: "fake-model",
      data: { ...validAnatomy, restatement: "updated" },
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
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);

    // Regression: the client only asked to act on problem_intelligence, but
    // this action also staled stakeholder_pain server-side. That must come
    // back in the same response so the UI can update both without a manual
    // refresh — see investigation-dashboard.tsx's staleSiblingPhases merge.
    if (result.ok) {
      expect(result.data.staleSiblingPhases).toHaveLength(1);
      expect(result.data.staleSiblingPhases?.[0]).toMatchObject({
        phaseKey: "stakeholder_pain",
        status: "needs_regeneration",
      });
    }
  });

  it("returns no staleSiblingPhases when a run has no downstream phases to stale", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows([])],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-1", status: "running", version: 1 })),
        row(
          phaseRow({
            id: "phase-1",
            status: "awaiting_approval",
            version: 1,
            output_data: validAnatomy,
          }),
        ),
      ],
    });
    const provider = fakeProvider({ status: "ok", model: "fake-model", data: validAnatomy });

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
      expect(result.data.staleSiblingPhases).toBeUndefined();
    }
  });
});

const validQuestionGeneratorOutput = {
  queries: [
    {
      query: "government crop pricing platform India",
      category: "GOVERNMENT",
      reason: "r",
      targetInformation: "t",
    },
  ],
};

const validSolutionExtractorOutput = {
  solutions: [
    {
      localId: "sol-1",
      name: "eNAM",
      organization: "Government of India",
      country: "India",
      yearIfVerified: "2016",
      solutionType: "GOVERNMENT_PROGRAM",
      problemAddressed: { claim: "x", status: "VERIFIED", reasoning: "y" },
      howItWorks: { claim: "x", status: "INFERENCE", reasoning: "y" },
      deploymentStatus: "ACTIVE",
      businessModelIfKnown: "UNKNOWN",
      sourceIds: ["source-1"],
      confidence: "medium",
      costInformation: "UNKNOWN",
      geographicCoverage: "India",
      evidenceConfidence: "medium",
    },
  ],
  consultantMessage: "We're not the first to attack this — a government platform already exists.",
};

const rawResearchSource = {
  title: "eNAM",
  url: "https://enam.gov.in",
  sourceType: "government",
  retrievedAt: now,
  snippet: "A national electronic trading platform.",
};

describe("executePhaseAction: existing_solutions (Phase 03) depends on approved Phase 01 AND Phase 02", () => {
  it("blocks Phase 03 when Phase 02 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
    expect(researchSearchMock).not.toHaveBeenCalled();
  });

  it("blocks Phase 03 when Phase 02 is awaiting approval", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
  });

  it("blocks Phase 03 when Phase 02 is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "needs_regeneration",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("runs Phase 03 successfully once Phase 01 and Phase 02 are both approved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-3", phase_key: "existing_solutions", status: "running" })),
        row(
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validQuestionGeneratorOutput },
      { status: "ok", model: "fake-model", data: validSolutionExtractorOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    expect(researchSearchMock).toHaveBeenCalledTimes(1);
    // Two distinct usage quotas were touched by this one phase run: the
    // outer engine's `ai` check around the whole run, and Phase 03's own
    // `research` check for its Tavily calls.
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "research");
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "research", 0);
  });

  it("marks Phase 03 failed (not fabricated) when the Existing Solution Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-3", phase_key: "existing_solutions", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validQuestionGeneratorOutput },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached, even before research starts", async () => {
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
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
    expect(researchSearchMock).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "existing_solutions",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 03, archiving history and bumping the version", async () => {
    const priorOutput = { queries: [], sources: [], solutions: [], researchCoverage: {}, stats: {}, consultantMessage: "old" };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validQuestionGeneratorOutput },
      { status: "ok", model: "fake-model", data: validSolutionExtractorOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 02 flags an already-approved Phase 03 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            version: 1,
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: { queries: [], sources: [], solutions: [], researchCoverage: {}, stats: {}, consultantMessage: "old" },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-2", phase_key: "stakeholder_pain", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedStakeholderPainOutput,
          }),
        ),
        noRow, // bulk update marking existing_solutions needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validStakeholderOutput },
      { status: "ok", model: "fake-model", data: validPainOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "stakeholder_pain",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedExistingSolutionsOutput = {
  queries: validQuestionGeneratorOutput.queries,
  sources: [
    {
      ...rawResearchSource,
      sourceLocalId: "source-1",
      query: validQuestionGeneratorOutput.queries[0].query,
      category: "GOVERNMENT",
    },
  ],
  solutions: [
    {
      ...validSolutionExtractorOutput.solutions[0],
      targetUsers: [],
      targetStakeholders: [],
      painAddressed: [],
      technology: [],
      strengths: [],
      limitations: [],
      evidenceClaims: [],
      stakeholderCoverage: ["farmer"],
      painCoverage: ["pain-1"],
    },
  ],
  researchCoverage: {
    commercial: "INSUFFICIENT",
    government: "LOW",
    academic: "INSUFFICIENT",
    startup: "INSUFFICIENT",
    openSource: "INSUFFICIENT",
    international: "INSUFFICIENT",
    technology: "INSUFFICIENT",
  },
  stats: {
    sourcesFound: 1,
    sourcesUsed: 1,
    solutionsIdentified: 1,
    queriesExecuted: 1,
    researchFailures: 0,
    budgetExhausted: false,
  },
  consultantMessage: validSolutionExtractorOutput.consultantMessage,
};

function gapClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = ["source-1"],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

const validGapAgentOutput = {
  problemSummary: "s",
  stakeholderSummary: "s",
  solutionLandscapeSummary: "s",
  gapCandidates: [
    {
      gapId: "gap-1",
      title: "No automated prioritization",
      description: "d",
      affectedStakeholders: ["farmer"],
      relatedPains: ["pain-1"],
      relatedExistingSolutions: ["sol-1"],
      missingCapability: gapClaim("INFERENCE"),
      whyItMatters: gapClaim("ASSUMPTION", []),
      evidenceClaims: [],
      sourceIds: ["source-1"],
      gapType: "FUNCTIONAL",
      confidence: "MEDIUM",
      gapState: "CANDIDATE_GAP",
      validationStatus: "NEEDS_VALIDATION",
    },
  ],
  coverageMatrix: [],
  gapPriority: [],
  gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
  validationQuestions: ["Does the platform support offline use?"],
  evidenceSummary: { narrative: "n" },
  confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
  consultantMessage: "m",
};

describe("executePhaseAction: gap_intelligence (Phase 04) depends on approved Phase 01, 02, AND 03", () => {
  it("blocks Phase 04 when Phase 03 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 04 when Phase 02 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 04 when Phase 02 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "needs_regeneration",
            output_data: mergedStakeholderPainOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // Note: `existing_solutions` (Phase 03) has `requiresApproval: false`
  // in the phase catalog (src/lib/prism/phases.ts) — the same, unmodified
  // orchestrator that gates Phase 01 -> 02 (both approval-gated) treats a
  // non-approval-gated upstream phase differently on purpose: it only
  // has to have actually run (not be `not_started` or `failed`), not be
  // explicitly `approved`. These two tests document that real behavior
  // rather than asserting a block that the existing gating mechanism was
  // never designed to apply here — inventing one would mean building a
  // second, phase-04-specific gating rule, which the task explicitly
  // rules out.
  it("allows Phase 04 to run while Phase 03 is only awaiting approval, since existing_solutions doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
            output_data: mergedExistingSolutionsOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "running" })),
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validGapAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 04 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 04 successfully once Phase 01, 02, and 03 are all approved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "running" })),
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validGapAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 04 failed (not fabricated) when the Gap Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "gap_intelligence",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 04, archiving history and bumping the version", async () => {
    const priorOutput = {
      problemSummary: "s",
      stakeholderSummary: "s",
      solutionLandscapeSummary: "s",
      gapCandidates: [],
      confirmedGaps: [],
      candidateGaps: [],
      unverifiedGaps: [],
      noGapFindings: [],
      coverageMatrix: [],
      gapPriority: [],
      gapRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
      validationQuestions: [],
      evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "old" },
      confidenceSummary: { overallConfidence: "LOW", narrative: "old" },
      consultantMessage: "old",
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validGapAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 03 flags an already-approved Phase 04 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            version: 1,
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: { ...validGapAgentOutput, confirmedGaps: [], candidateGaps: [], unverifiedGaps: [], noGapFindings: [] },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-3", phase_key: "existing_solutions", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedExistingSolutionsOutput,
          }),
        ),
        noRow, // bulk update marking gap_intelligence needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validQuestionGeneratorOutput },
      { status: "ok", model: "fake-model", data: validSolutionExtractorOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "existing_solutions",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedGapIntelligenceOutput = {
  problemSummary: "s",
  stakeholderSummary: "s",
  solutionLandscapeSummary: "s",
  gapCandidates: validGapAgentOutput.gapCandidates,
  confirmedGaps: [],
  candidateGaps: ["gap-1"],
  unverifiedGaps: [],
  noGapFindings: [],
  coverageMatrix: [],
  gapPriority: [],
  gapRealityCheck: { signal: "MODERATE_GAP_SIGNAL", explanation: "e" },
  validationQuestions: ["Does the platform support offline use?"],
  evidenceSummary: { totalSourcesReferenced: 1, verifiedClaimsCount: 0, narrative: "n" },
  confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n" },
  consultantMessage: "m",
};

function opportunityClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

const validOpportunityAgentOutput = {
  opportunities: [
    {
      opportunityId: "opp-1",
      title: "District-level price transparency service",
      description: "d",
      unservedNeed: opportunityClaim("INFERENCE"),
      affectedStakeholders: ["farmer"],
      relatedPains: ["pain-1"],
      relatedGaps: ["gap-1"],
      existingSolutionContext: opportunityClaim("ASSUMPTION"),
      whyNow: { factors: [], summary: "s" },
      impact: [],
      valuePotential: { value: 60, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      impactPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      evidenceClaims: [],
      confidence: "medium",
      opportunityState: "PROMISING_OPPORTUNITY",
    },
  ],
};

const validInnovationAgentOutput = {
  assessments: [
    {
      opportunityId: "opp-1",
      innovationDirections: [
        {
          directionType: "SOFTWARE",
          whyItCouldAddressTheGap: "a",
          whatItWouldChange: "b",
          stakeholderBenefit: "c",
          newCapability: "d",
          assumptionsRequired: [],
          aiJustification: { classification: "AI_OPTIONAL", reasoning: "e" },
        },
      ],
      differentiation: opportunityClaim("ASSUMPTION"),
      innovationPotential: { value: 55, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      feasibilityPotential: { value: 50, basis: "ai_estimate", reasoning: "n/a", confidence: "medium" },
      refinedOpportunityState: "PROMISING_OPPORTUNITY",
      validationQuestions: [],
    },
  ],
  opportunityLandscape: [
    {
      opportunityId: "opp-1",
      stakeholderValue: "medium",
      painRelevance: "medium",
      gapStrength: "medium",
      differentiationStrength: "low",
      innovationStrength: "medium",
      feasibilityStrength: "high",
      impactStrength: "medium",
      confidence: "medium",
      reasoning: "n/a",
    },
  ],
  opportunityRealityCheck: { signal: "PROMISING", explanation: "e" },
  consultantMessage: "m",
};

const approvedPhasesThroughGapIntelligence = [
  phaseRow({
    id: "phase-1",
    phase_key: "problem_intelligence",
    status: "approved",
    output_data: validAnatomy,
  }),
  phaseRow({
    id: "phase-2",
    phase_key: "stakeholder_pain",
    status: "approved",
    output_data: mergedStakeholderPainOutput,
  }),
  phaseRow({
    id: "phase-3",
    phase_key: "existing_solutions",
    status: "approved",
    output_data: mergedExistingSolutionsOutput,
  }),
  phaseRow({
    id: "phase-4",
    phase_key: "gap_intelligence",
    status: "approved",
    output_data: mergedGapIntelligenceOutput,
  }),
];

describe("executePhaseAction: opportunity_innovation (Phase 05) depends on approved Phase 01, 02, 04 AND has-run Phase 03", () => {
  it("blocks Phase 05 when Phase 04 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 05 when Phase 02 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 05 when Phase 04 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence.slice(0, 3),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "needs_regeneration",
            output_data: mergedGapIntelligenceOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) has requiresApproval: false — the same
  // unmodified gating that Phase 04 relies on applies unchanged to
  // Phase 05: Phase 03 only has to have run, not be explicitly approved.
  it("allows Phase 05 to run while Phase 03 is only awaiting approval, since existing_solutions doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "running" })),
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validOpportunityAgentOutput },
      { status: "ok", model: "fake-model", data: validInnovationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 05 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 05 successfully once Phase 01, 02, 03, and 04 have all cleared their gates, charging exactly one AI usage unit for both agent calls", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughGapIntelligence)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "running" })),
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validOpportunityAgentOutput },
      { status: "ok", model: "fake-model", data: validInnovationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    expect(checkUsageMock).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 05 failed (not fabricated) when the Opportunity Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughGapIntelligence)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("marks Phase 05 failed when the Opportunity Agent's output references a gap the pipeline never produced", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughGapIntelligence)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      {
        status: "ok",
        model: "fake-model",
        data: {
          opportunities: [
            {
              ...validOpportunityAgentOutput.opportunities[0],
              relatedGaps: ["ghost-gap"],
            },
          ],
        },
      },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughGapIntelligence)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "opportunity_innovation",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 05, archiving history and bumping the version", async () => {
    const priorOutput = {
      opportunities: [],
      opportunityLandscape: [],
      opportunityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
      overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
      consultantMessage: "old",
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validOpportunityAgentOutput },
      { status: "ok", model: "fake-model", data: validInnovationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 04 flags an already-approved Phase 05 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence.slice(0, 3),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            version: 1,
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: {
              opportunities: [],
              opportunityLandscape: [],
              opportunityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
              overallFinding: "NO_MEANINGFUL_OPPORTUNITY",
              consultantMessage: "old",
            },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedGapIntelligenceOutput,
          }),
        ),
        noRow, // bulk update marking opportunity_innovation needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validGapAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "gap_intelligence",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedOpportunityInnovationOutput = {
  opportunities: [
    {
      ...validOpportunityAgentOutput.opportunities[0],
      innovationDirections: validInnovationAgentOutput.assessments[0].innovationDirections,
      differentiation: validInnovationAgentOutput.assessments[0].differentiation,
      innovationPotential: validInnovationAgentOutput.assessments[0].innovationPotential,
      feasibilityPotential: validInnovationAgentOutput.assessments[0].feasibilityPotential,
      opportunityState: validInnovationAgentOutput.assessments[0].refinedOpportunityState,
      validationQuestions: validInnovationAgentOutput.assessments[0].validationQuestions,
    },
  ],
  opportunityLandscape: [{ ...validInnovationAgentOutput.opportunityLandscape[0], rank: 1 }],
  opportunityRealityCheck: validInnovationAgentOutput.opportunityRealityCheck,
  overallFinding: "MEANINGFUL_OPPORTUNITY_FOUND",
  consultantMessage: validInnovationAgentOutput.consultantMessage,
};

const approvedPhasesThroughOpportunityInnovation = [
  ...approvedPhasesThroughGapIntelligence,
  phaseRow({
    id: "phase-5",
    phase_key: "opportunity_innovation",
    status: "approved",
    output_data: mergedOpportunityInnovationOutput,
  }),
];

function unknownMarketNumber() {
  return {
    status: "UNKNOWN",
    value: null,
    unit: null,
    currency: null,
    geography: null,
    period: null,
    sourceIds: [],
    calculation: null,
    confidence: "low",
    reasoning: "n/a",
  };
}

const validMarketQuestionOutput = {
  queries: [
    {
      query: "market size for crop price transparency platforms in India",
      category: "MARKET_SIZE",
      reason: "r",
      targetInformation: "t",
    },
  ],
};

const validMarketAgentOutput = {
  marketSummary: "s",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "MEDIUM", reasoning: "n/a" },
  tamAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  samAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  somAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  businessModels: [],
  unitEconomics: {
    customerAcquisitionCost: unknownMarketNumber(),
    revenuePerCustomer: unknownMarketNumber(),
    grossMargin: unknownMarketNumber(),
    operationalCost: unknownMarketNumber(),
    supportCost: unknownMarketNumber(),
    infrastructureCost: unknownMarketNumber(),
    paybackPeriod: unknownMarketNumber(),
    narrative: "n/a",
  },
  scalability: {
    technical: { level: "UNKNOWN", reasoning: "n/a" },
    operational: { level: "UNKNOWN", reasoning: "n/a" },
    geographic: { level: "UNKNOWN", reasoning: "n/a" },
    customer: { level: "UNKNOWN", reasoning: "n/a" },
    support: { level: "UNKNOWN", reasoning: "n/a" },
    regulatory: { level: "UNKNOWN", reasoning: "n/a" },
    data: { level: "UNKNOWN", reasoning: "n/a" },
  },
  marketRealityCheck: { signal: "EARLY_MARKET", explanation: "e" },
  marketScores: {
    marketPotential: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 30, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 35, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  validationQuestions: [],
};

const validInvestmentAgentOutput = {
  investmentAnalysis: {
    capitalIntensity: "MODERATE",
    capitalIntensityReasoning: "r",
    initialDevelopmentRequirements: [],
    infrastructureRequirements: [],
    teamRequirements: [],
    operationalRequirements: [],
    deploymentRequirements: [],
    fundingStageRecommendation: "PRE_SEED",
    fundingStageReasoning: "r",
  },
  valuationDrivers: { drivers: [], illustrativeScenario: null },
  investmentRealityCheck: { signal: "RESEARCH_BEFORE_INVESTMENT", explanation: "e" },
  investmentScores: {
    investmentReadiness: { value: 25, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  confidenceSummary: { overallConfidence: "WEAK", narrative: "n/a" },
  validationQuestions: [],
  consultantMessage: "m",
};

describe("executePhaseAction: market_investment (Phase 06) depends on approved Phase 01, 02, 04, 05 AND has-run Phase 03", () => {
  it("blocks Phase 06 when Phase 05 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughGapIntelligence)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 06 when Phase 02 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "awaiting_approval",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "approved",
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 06 when Phase 05 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "needs_regeneration",
            output_data: mergedOpportunityInnovationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) has requiresApproval: false — the same
  // unmodified gating that Phase 04/05 rely on applies unchanged to
  // Phase 06: Phase 03 only has to have run, not be explicitly approved.
  it("allows Phase 06 to run while Phase 03 is only awaiting approval, since existing_solutions doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "awaiting_approval",
            output_data: mergedExistingSolutionsOutput,
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "running" })),
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validMarketQuestionOutput },
      { status: "ok", model: "fake-model", data: validMarketAgentOutput },
      { status: "ok", model: "fake-model", data: validInvestmentAgentOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 06 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 06 successfully once Phase 01, 02, 03, 04, and 05 have all cleared their gates, touching both the ai and research usage quotas", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughOpportunityInnovation)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "running" })),
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validMarketQuestionOutput },
      { status: "ok", model: "fake-model", data: validMarketAgentOutput },
      { status: "ok", model: "fake-model", data: validInvestmentAgentOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(3);
    expect(researchSearchMock).toHaveBeenCalledTimes(1);
    // The outer engine's `ai` check around the whole run, plus Phase 06's
    // own `research` check for its Tavily calls — the same two-quota
    // pattern Phase 03 established.
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "research");
    expect(recordUsageMock).toHaveBeenCalledWith("user-1", "research", 0);
  });

  it("marks Phase 06 failed (not fabricated) when the Market Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughOpportunityInnovation)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validMarketQuestionOutput },
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughOpportunityInnovation)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "market_investment",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 06, archiving history and bumping the version", async () => {
    const priorOutput = {
      marketSummary: "old",
      customerModel: null,
      marketSegments: [],
      competitiveLandscape: {
        competitors: [],
        summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
      },
      marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
      adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "old" },
      marketEvidence: { sources: [], status: "COMPLETE", narrative: "old" },
      tamAnalysis: { definition: "n/a", value: unknownMarketNumber() },
      samAnalysis: { definition: "n/a", value: unknownMarketNumber() },
      somAnalysis: { definition: "n/a", value: unknownMarketNumber() },
      businessModels: [],
      pricingHypotheses: [],
      unitEconomics: {
        customerAcquisitionCost: unknownMarketNumber(),
        revenuePerCustomer: unknownMarketNumber(),
        grossMargin: unknownMarketNumber(),
        operationalCost: unknownMarketNumber(),
        supportCost: unknownMarketNumber(),
        infrastructureCost: unknownMarketNumber(),
        paybackPeriod: unknownMarketNumber(),
        narrative: "old",
      },
      scalability: {
        technical: { level: "UNKNOWN", reasoning: "old" },
        operational: { level: "UNKNOWN", reasoning: "old" },
        geographic: { level: "UNKNOWN", reasoning: "old" },
        customer: { level: "UNKNOWN", reasoning: "old" },
        support: { level: "UNKNOWN", reasoning: "old" },
        regulatory: { level: "UNKNOWN", reasoning: "old" },
        data: { level: "UNKNOWN", reasoning: "old" },
      },
      investmentAnalysis: {
        capitalIntensity: "MODERATE",
        capitalIntensityReasoning: "old",
        initialDevelopmentRequirements: [],
        infrastructureRequirements: [],
        teamRequirements: [],
        operationalRequirements: [],
        deploymentRequirements: [],
        fundingStageRecommendation: "PRE_SEED",
        fundingStageReasoning: "old",
      },
      valuationDrivers: { drivers: [], illustrativeScenario: null },
      marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
      investmentRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
      marketScores: {
        marketPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
        commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
        adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
        scalability: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
      },
      investmentScores: {
        investmentReadiness: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
      },
      evidenceSummary: {
        totalSourcesReferenced: 0,
        verifiedNumbersCount: 0,
        modelEstimateNumbersCount: 0,
        unknownNumbersCount: 7,
        narrative: "old",
      },
      confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "old" },
      validationQuestions: [],
      consultantMessage: "old",
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validMarketQuestionOutput },
      { status: "ok", model: "fake-model", data: validMarketAgentOutput },
      { status: "ok", model: "fake-model", data: validInvestmentAgentOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 05 flags an already-approved Phase 06 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            version: 1,
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: {
              marketSummary: "old",
              customerModel: null,
              marketSegments: [],
              competitiveLandscape: {
                competitors: [],
                summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
              },
              marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
              adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "old" },
              marketEvidence: { sources: [], status: "COMPLETE", narrative: "old" },
              tamAnalysis: { definition: "n/a", value: unknownMarketNumber() },
              samAnalysis: { definition: "n/a", value: unknownMarketNumber() },
              somAnalysis: { definition: "n/a", value: unknownMarketNumber() },
              businessModels: [],
              pricingHypotheses: [],
              unitEconomics: {
                customerAcquisitionCost: unknownMarketNumber(),
                revenuePerCustomer: unknownMarketNumber(),
                grossMargin: unknownMarketNumber(),
                operationalCost: unknownMarketNumber(),
                supportCost: unknownMarketNumber(),
                infrastructureCost: unknownMarketNumber(),
                paybackPeriod: unknownMarketNumber(),
                narrative: "old",
              },
              scalability: {
                technical: { level: "UNKNOWN", reasoning: "old" },
                operational: { level: "UNKNOWN", reasoning: "old" },
                geographic: { level: "UNKNOWN", reasoning: "old" },
                customer: { level: "UNKNOWN", reasoning: "old" },
                support: { level: "UNKNOWN", reasoning: "old" },
                regulatory: { level: "UNKNOWN", reasoning: "old" },
                data: { level: "UNKNOWN", reasoning: "old" },
              },
              investmentAnalysis: {
                capitalIntensity: "MODERATE",
                capitalIntensityReasoning: "old",
                initialDevelopmentRequirements: [],
                infrastructureRequirements: [],
                teamRequirements: [],
                operationalRequirements: [],
                deploymentRequirements: [],
                fundingStageRecommendation: "PRE_SEED",
                fundingStageReasoning: "old",
              },
              valuationDrivers: { drivers: [], illustrativeScenario: null },
              marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
              investmentRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "old" },
              marketScores: {
                marketPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
                commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
                adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
                scalability: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
              },
              investmentScores: {
                investmentReadiness: { value: 10, basis: "ai_estimate", reasoning: "old", confidence: "low" },
              },
              evidenceSummary: {
                totalSourcesReferenced: 0,
                verifiedNumbersCount: 0,
                modelEstimateNumbersCount: 0,
                unknownNumbersCount: 7,
                narrative: "old",
              },
              confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "old" },
              validationQuestions: [],
              consultantMessage: "old",
            },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-5", phase_key: "opportunity_innovation", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedOpportunityInnovationOutput,
          }),
        ),
        noRow, // bulk update marking market_investment needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validOpportunityAgentOutput },
      { status: "ok", model: "fake-model", data: validInnovationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "opportunity_innovation",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedMarketInvestmentOutput = {
  marketSummary: "s",
  customerModel: null,
  marketSegments: [],
  competitiveLandscape: {
    competitors: [],
    summary: { claim: "x", status: "ASSUMPTION", sourceIds: [], confidence: "low", reasoning: "y" },
  },
  marketDrivers: { adoptionDrivers: [], adoptionBarriers: [] },
  adoptionAnalysis: { factors: [], adoptionRisk: "UNKNOWN", reasoning: "n/a" },
  marketEvidence: {
    sources: [
      {
        sourceLocalId: "source-1",
        title: "eNAM",
        url: "https://enam.gov.in",
        sourceType: "government",
        retrievedAt: new Date().toISOString(),
        snippet: "A national electronic trading platform.",
        origin: "existing_solutions_reused",
      },
    ],
    status: "COMPLETE",
    narrative: "n/a",
  },
  tamAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  samAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  somAnalysis: { definition: "n/a", value: unknownMarketNumber() },
  businessModels: [],
  pricingHypotheses: [],
  unitEconomics: {
    customerAcquisitionCost: unknownMarketNumber(),
    revenuePerCustomer: unknownMarketNumber(),
    grossMargin: unknownMarketNumber(),
    operationalCost: unknownMarketNumber(),
    supportCost: unknownMarketNumber(),
    infrastructureCost: unknownMarketNumber(),
    paybackPeriod: unknownMarketNumber(),
    narrative: "n/a",
  },
  scalability: {
    technical: { level: "UNKNOWN", reasoning: "n/a" },
    operational: { level: "UNKNOWN", reasoning: "n/a" },
    geographic: { level: "UNKNOWN", reasoning: "n/a" },
    customer: { level: "UNKNOWN", reasoning: "n/a" },
    support: { level: "UNKNOWN", reasoning: "n/a" },
    regulatory: { level: "UNKNOWN", reasoning: "n/a" },
    data: { level: "UNKNOWN", reasoning: "n/a" },
  },
  investmentAnalysis: {
    capitalIntensity: "MODERATE",
    capitalIntensityReasoning: "r",
    initialDevelopmentRequirements: [],
    infrastructureRequirements: [],
    teamRequirements: [],
    operationalRequirements: [],
    deploymentRequirements: [],
    fundingStageRecommendation: "PRE_SEED",
    fundingStageReasoning: "r",
  },
  valuationDrivers: { drivers: [], illustrativeScenario: null },
  marketRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  investmentRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  marketScores: {
    marketPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    commercialPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionPotential: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    scalability: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  investmentScores: {
    investmentReadiness: { value: 10, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  evidenceSummary: {
    totalSourcesReferenced: 1,
    verifiedNumbersCount: 0,
    modelEstimateNumbersCount: 0,
    unknownNumbersCount: 11,
    narrative: "n/a",
  },
  confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
  validationQuestions: [],
  consultantMessage: "m",
};

const approvedPhasesThroughMarketInvestment = [
  ...approvedPhasesThroughOpportunityInnovation,
  phaseRow({
    id: "phase-6",
    phase_key: "market_investment",
    status: "approved",
    output_data: mergedMarketInvestmentOutput,
  }),
];

function feasibilityTechnicalDimension() {
  return { status: "UNKNOWN", reasoning: "n/a", confidence: "low", evidenceClaims: [] };
}

function feasibilitySoftwareComponent() {
  return { status: "REQUIRES_BUILD", reasoning: "n/a" };
}

function feasibilityScalabilityAssessment() {
  return { level: "UNKNOWN", reasoning: "n/a" };
}

function feasibilityScore() {
  return { value: 20, basis: "ai_estimate", reasoning: "n/a", confidence: "low" };
}

const validFeasibilityAgentOutput = {
  modeFeasibility: {
    mode: "HACKATHON",
    hackathon: {
      timeAvailable: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      teamSize: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      teamSkills: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      hardwareAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      softwareAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      apiAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      dataAccess: { claim: "x", status: "UNKNOWN", sourceIds: [], confidence: "low", reasoning: "y" },
      prototypeScope: "a",
      demoScope: "b",
      deploymentScope: "c",
      durationFeasibility: [],
    },
    pbl: null,
    startup: null,
    research: null,
    zeroDegree: null,
  },
  technicalFeasibility: {
    architecture: feasibilityTechnicalDimension(),
    technologyMaturity: feasibilityTechnicalDimension(),
    dependencies: feasibilityTechnicalDimension(),
    apis: feasibilityTechnicalDimension(),
    hardware: feasibilityTechnicalDimension(),
    software: feasibilityTechnicalDimension(),
    data: feasibilityTechnicalDimension(),
    infrastructure: feasibilityTechnicalDimension(),
    integration: feasibilityTechnicalDimension(),
    security: feasibilityTechnicalDimension(),
    performance: feasibilityTechnicalDimension(),
    reliability: feasibilityTechnicalDimension(),
    maintenance: feasibilityTechnicalDimension(),
  },
  dataFeasibility: { requirements: [], narrative: "n/a" },
  aiFeasibility: null,
  hardwareFeasibility: null,
  softwareFeasibility: {
    frontend: feasibilitySoftwareComponent(),
    backend: feasibilitySoftwareComponent(),
    database: feasibilitySoftwareComponent(),
    api: feasibilitySoftwareComponent(),
    authentication: feasibilitySoftwareComponent(),
    deployment: feasibilitySoftwareComponent(),
    mobileOrWeb: feasibilitySoftwareComponent(),
    thirdPartyServices: feasibilitySoftwareComponent(),
    openSourceDependencies: feasibilitySoftwareComponent(),
  },
  teamFeasibility: { skills: [], narrative: "n/a" },
  timeFeasibility: {
    minimumViableBuildTime: unknownMarketNumber(),
    prototypeTime: unknownMarketNumber(),
    productionTime: unknownMarketNumber(),
    hackathonDurationFeasibility: [],
  },
  costFeasibility: {
    developmentCost: unknownMarketNumber(),
    hardwareCost: unknownMarketNumber(),
    softwareCost: unknownMarketNumber(),
    apiCost: unknownMarketNumber(),
    infrastructureCost: unknownMarketNumber(),
    deploymentCost: unknownMarketNumber(),
    maintenanceCost: unknownMarketNumber(),
  },
  regulatorySafety: { items: [], narrative: "n/a" },
  securityPrivacy: { considerations: [], securityRisk: "UNKNOWN", reasoning: "n/a" },
  scalability: {
    technical: feasibilityScalabilityAssessment(),
    data: feasibilityScalabilityAssessment(),
    infrastructure: feasibilityScalabilityAssessment(),
    operational: feasibilityScalabilityAssessment(),
    support: feasibilityScalabilityAssessment(),
    geographic: feasibilityScalabilityAssessment(),
    regulatory: feasibilityScalabilityAssessment(),
  },
  riskRegister: [],
  buildScope: { mustBuild: [], shouldBuild: [], couldBuild: [], doNotBuild: [] },
  feasibilityScores: {
    technical: feasibilityScore(),
    data: feasibilityScore(),
    time: feasibilityScore(),
    cost: feasibilityScore(),
    team: feasibilityScore(),
    deployment: feasibilityScore(),
    scalability: feasibilityScore(),
  },
  overallFeasibility: { status: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  criticalBlockers: [],
  feasibilityRealityCheck: { signal: "INSUFFICIENT_EVIDENCE", explanation: "e" },
  implementationRoadmap: [
    { phaseNumber: 0, title: "Preparation", description: "d", deliverables: [] },
  ],
  validationQuestions: [],
  evidenceSummary: { narrative: "n/a" },
  confidenceSummary: { overallConfidence: "INSUFFICIENT_EVIDENCE", narrative: "n/a" },
  consultantMessage: "m",
};

describe("executePhaseAction: technical_feasibility (Phase 07) depends on approved Phase 01, 02, 04, 05, 06 AND has-run Phase 03", () => {
  it("blocks Phase 07 when Phase 06 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughOpportunityInnovation)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 07 when Phase 05 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 07 when Phase 05 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "needs_regeneration",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) has requiresApproval: false, and so does
  // market_investment (Phase 06) — the same unmodified gating applies
  // unchanged to Phase 07: both only have to have run, not be explicitly
  // approved.
  it("allows Phase 07 to run while Phase 06 is only awaiting approval, since market_investment doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            output_data: mergedMarketInvestmentOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "running" })),
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validFeasibilityAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 07 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 07 successfully once Phase 01 through 06 have all cleared their gates", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughMarketInvestment)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "running" })),
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validFeasibilityAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 07 failed (not fabricated) when the Feasibility Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughMarketInvestment)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughMarketInvestment)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "technical_feasibility",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 07, archiving history and bumping the version", async () => {
    const priorOutput = { ...validFeasibilityAgentOutput, criticalBlockersSummary: "NONE_IDENTIFIED", evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "old" } };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughMarketInvestment,
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validFeasibilityAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 06 flags an already-approved Phase 07 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            version: 1,
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: { ...validFeasibilityAgentOutput, criticalBlockersSummary: "NONE_IDENTIFIED", evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "old" } },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-6", phase_key: "market_investment", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedMarketInvestmentOutput,
          }),
        ),
        noRow, // bulk update marking technical_feasibility needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validMarketQuestionOutput },
      { status: "ok", model: "fake-model", data: validMarketAgentOutput },
      { status: "ok", model: "fake-model", data: validInvestmentAgentOutput },
    ]);
    researchSearchMock.mockResolvedValueOnce({
      status: "ok",
      provider: "mock",
      sources: [rawResearchSource],
    });

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "market_investment",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedTechnicalFeasibilityOutput = {
  ...validFeasibilityAgentOutput,
  evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
  criticalBlockersSummary: "NONE_IDENTIFIED",
};

const approvedPhasesThroughTechnicalFeasibility = [
  ...approvedPhasesThroughMarketInvestment,
  phaseRow({
    id: "phase-7",
    phase_key: "technical_feasibility",
    status: "approved",
    output_data: mergedTechnicalFeasibilityOutput,
  }),
];

function solutionClaim(
  status: "VERIFIED" | "INFERENCE" | "ASSUMPTION" | "UNKNOWN" = "INFERENCE",
  sourceIds: string[] = [],
) {
  return { claim: "x", status, sourceIds, confidence: "medium", reasoning: "y" };
}

const validSolutionConsultantAgentOutput = {
  solution: {
    solutionId: "sol-1",
    name: "PriceLens",
    tagline: "t",
    executiveSummary: "s",
    problemAddressed: solutionClaim(),
    primaryUsers: ["farmer"],
    customers: [],
    beneficiaries: ["farmer"],
    coreValueProposition: "v",
    validatedGapId: "gap-1",
    opportunityId: "opp-1",
    differentiation: {
      genuinelyDifferent: "a",
      incremental: "b",
      defensible: "c",
      merelyAFeature: "d",
      overallClaim: solutionClaim("ASSUMPTION"),
    },
    solutionType: "SOFTWARE",
    technologyApproach: "t",
    aiRole: {
      classification: "AI_NOT_REQUIRED",
      whyAiIsNeeded: "n/a",
      whatAiDoes: "n/a",
      whatAiDoesNot: "n/a",
      reasoning: "y",
    },
    hardwareRole: null,
    softwareRole: "s",
    dataRole: "d",
    workflow: ["step 1"],
    architecture: {
      inputs: [],
      processing: [],
      aiComponents: [],
      deterministicComponents: [],
      database: [],
      externalApis: [],
      hardware: [],
      outputs: [],
    },
    userJourney: [{ stage: "START", description: "d" }],
    coreFeatures: [],
    mustHaveFeatures: [],
    futureFeatures: [],
    implementationPlan: [
      {
        stepNumber: 0,
        objective: "o",
        deliverable: "d",
        dependency: "n/a",
        estimatedEffort: unknownMarketNumber(),
        risk: "n/a",
        completionCondition: "c",
      },
    ],
    risks: [],
    limitations: [],
    evidenceClaims: [],
    confidence: "medium",
  },
  whyThisSolution: {
    painAddressed: "p",
    gapAddressed: "g",
    opportunityAddressed: "o",
    existingSolutionLimitations: "l",
    feasibilityRationale: "f",
    marketRationale: "m",
    summary: "s",
  },
  alternativesConsidered: [],
  featureScope: {
    mustHave: [{ title: "core feature", reasoning: "r" }],
    shouldHave: [],
    future: [],
    doNotBuild: [],
  },
  dataFlow: {
    input: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    ingestion: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    validation: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    processing: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    intelligence: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    decision: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
    output: { component: "c", responsibility: "r", input: "i", output: "o", dependency: "d", risk: "k" },
  },
  engineeringSafety: null,
  aiArchitecture: null,
  humanInTheLoop: [],
  technologyStack: [],
  pocDefinition: {
    objective: "o",
    scope: "s",
    input: "i",
    process: "p",
    output: "o",
    successCriteria: ["works"],
    failureCriteria: ["doesn't work"],
  },
  successMetrics: [],
  modeSolutionPlan: {
    mode: "HACKATHON",
    hackathon: {
      buildPlan24Hour: ["step 1"],
      demoFlow: ["show the app"],
      mustBuild: [],
      shouldBuild: [],
      doNotBuild: [],
      demoNarrative: "n",
      judgeFacingValueProposition: "v",
    },
    pbl: null,
    startup: null,
    research: null,
    zeroDegree: null,
  },
  acknowledgedCriticalBlockers: [],
  solutionRealityCheck: { status: "RECOMMENDED_WITH_CONSTRAINTS", explanation: "e" },
  evidenceSummary: { narrative: "n/a" },
  confidenceSummary: { overallConfidence: "MODERATE", narrative: "n/a" },
  consultantMessage: "m",
};

describe("executePhaseAction: solution_consultant (Phase 08) depends on approved Phase 01, 02, 04, 05, 07 AND has-run Phase 03, 06", () => {
  it("blocks Phase 08 when Phase 07 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughMarketInvestment)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 08 when Phase 05 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 08 when Phase 05 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "needs_regeneration",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) and market_investment (Phase 06) both
  // have requiresApproval: false — the same unmodified gating applies
  // unchanged to Phase 08: both only have to have run, not be explicitly
  // approved.
  it("allows Phase 08 to run while Phase 06 is only awaiting approval, since market_investment doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "running" })),
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validSolutionConsultantAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 08 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 08 successfully once Phase 01 through 07 have all cleared their gates", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughTechnicalFeasibility)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "running" })),
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validSolutionConsultantAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 08 failed (not fabricated) when the Solution Consultant returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughTechnicalFeasibility)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughTechnicalFeasibility)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "solution_consultant",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 08, archiving history and bumping the version", async () => {
    const priorOutput = {
      ...validSolutionConsultantAgentOutput,
      evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "old" },
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughTechnicalFeasibility,
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validSolutionConsultantAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 07 flags an already-approved Phase 08 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughMarketInvestment,
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            version: 1,
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: {
              ...validSolutionConsultantAgentOutput,
              evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "old" },
            },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-7", phase_key: "technical_feasibility", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedTechnicalFeasibilityOutput,
          }),
        ),
        noRow, // bulk update marking solution_consultant needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validFeasibilityAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "technical_feasibility",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedSolutionConsultantOutput = {
  ...validSolutionConsultantAgentOutput,
  evidenceSummary: { totalSourcesReferenced: 0, verifiedClaimsCount: 0, narrative: "n/a" },
};

const approvedPhasesThroughSolutionConsultant = [
  ...approvedPhasesThroughTechnicalFeasibility,
  phaseRow({
    id: "phase-8",
    phase_key: "solution_consultant",
    status: "approved",
    output_data: mergedSolutionConsultantOutput,
  }),
];

function validationJuryReview() {
  return {
    strengths: ["s"],
    questions: ["q"],
    concerns: ["c"],
    criticalQuestion: "cq",
    scoreOrAssessment: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    reasoning: "r",
    confidence: "medium",
  };
}

const validValidationAgentOutput = {
  validationClaims: [
    {
      validationId: "val-1",
      domain: "MARKET_VALIDATION",
      claim: "c",
      question: "q",
      evidence: "e",
      evidenceStatus: "ASSUMPTION",
      sourceIds: [],
      finding: "f",
      confidence: "medium",
      severity: "medium",
      recommendedAction: "a",
    },
  ],
  assumptionRegister: [
    {
      assumptionId: "assume-1",
      assumption: "Farmers will pay for pricing data.",
      category: "MARKET",
      whyItMatters: "w",
      dependency: "d",
      confidence: "medium",
      validationMethod: "m",
      failureImpact: "f",
      status: "SUPPORTED",
    },
  ],
  redTeamReview: {
    points: [
      {
        pointId: "rt-1",
        argument: "a",
        category: "HYPOTHETICAL",
        targetArea: "t",
        severity: "medium",
        sourceIds: [],
      },
    ],
    mostFragileAssumptionId: "assume-1",
    hiddenDependencies: [],
    keyTechnologyFailureImpact: null,
    summary: "s",
  },
  jury: {
    technicalJudge: validationJuryReview(),
    domainExpert: validationJuryReview(),
    businessJudge: validationJuryReview(),
    impactJudge: validationJuryReview(),
    productJudge: validationJuryReview(),
  },
  juryQuestions: [
    {
      questionId: "jq-1",
      question: "q",
      bestAnswer: "a",
      evidence: "e",
      sourceIds: [],
      confidence: "medium",
      answerStatus: "DEFENSIBLE",
    },
  ],
  failureModes: [
    {
      failureId: "fm-1",
      failure: "f",
      cause: "c",
      impact: "i",
      likelihood: "medium",
      severity: "medium",
      detection: "d",
      mitigation: "m",
      fallback: "fb",
      basis: "ai_estimate",
      confidence: "low",
    },
  ],
  preMortem: {
    scenario: "s",
    entries: [
      { failureReason: "r", earlyWarningSignal: "w", preventiveAction: "p", fallback: "f" },
    ],
  },
  counterSolutionAnalysis: {
    simplestAlternative: "s",
    recommended: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
    simpler: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
    existing: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
    manualWorkaround: { description: "d", addressesCoreProblem: "a", tradeoffs: "t" },
    conclusion: "RECOMMENDED_SOLUTION_JUSTIFIED",
    reasoning: "r",
  },
  buildRecommendation: "BUILD_WITH_CHANGES",
  buildRecommendationReasoning: "r",
  validationPlan: [
    {
      validationId: "exp-1",
      hypothesis: "h",
      method: "m",
      participantsOrData: "p",
      measurement: "m",
      successCriteria: ["works"],
      failureCriteria: ["doesn't"],
      estimatedEffort: unknownMarketNumber(),
      priority: "medium",
    },
  ],
  pocValidation: { status: "POC_VALID", explanation: "e" },
  successMetricsReview: {
    wellDefined: false,
    measurable: false,
    relevant: false,
    realistic: false,
    explanation: "Phase 08 proposed no success metrics.",
  },
  criticalAssumption: { assumptionId: "assume-1", reasoning: "r" },
  validationScores: {
    problemConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    solutionConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    marketConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    technicalConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    adoptionConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
    evidenceConfidence: { value: 40, basis: "ai_estimate", reasoning: "n/a", confidence: "low" },
  },
  evidenceSummary: { narrative: "n/a" },
  confidenceSummary: { overallConfidence: "MEDIUM", narrative: "n/a" },
  consultantMessage: "m",
};

describe("executePhaseAction: poc_validation (Phase 09) depends on approved Phase 01, 02, 04, 05, 07, 08 AND has-run Phase 03, 06", () => {
  it("blocks Phase 09 when Phase 08 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughTechnicalFeasibility)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 09 when Phase 05 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 09 when Phase 05 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "needs_regeneration",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) and market_investment (Phase 06) both
  // have requiresApproval: false — the same unmodified gating applies
  // unchanged to Phase 09: both only have to have run, not be explicitly
  // approved.
  it("allows Phase 09 to run while Phase 06 is only awaiting approval, since market_investment doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "running" })),
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validValidationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 09 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 09 successfully once Phase 01 through 08 have all cleared their gates", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughSolutionConsultant)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "running" })),
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validValidationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 09 failed (not fabricated) when the Validation Agent returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughSolutionConsultant)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughSolutionConsultant)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "poc_validation",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 09, archiving history and bumping the version", async () => {
    const priorOutput = {
      ...validValidationAgentOutput,
      evidenceSummary: {
        totalSourcesReferenced: 0,
        verifiedClaimsCount: 0,
        contradictedClaimsCount: 0,
        narrative: "old",
      },
      finalValidationDecision: "PROCEED_WITH_CHANGES",
      finalValidationDecisionReasoning: ["old reasoning"],
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughSolutionConsultant,
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validValidationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 08 flags an already-approved Phase 09 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughTechnicalFeasibility,
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            version: 1,
            output_data: mergedSolutionConsultantOutput,
          }),
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            output_data: {
              ...validValidationAgentOutput,
              evidenceSummary: {
                totalSourcesReferenced: 0,
                verifiedClaimsCount: 0,
                contradictedClaimsCount: 0,
                narrative: "old",
              },
              finalValidationDecision: "PROCEED_WITH_CHANGES",
              finalValidationDecisionReasoning: ["old reasoning"],
            },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-8", phase_key: "solution_consultant", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedSolutionConsultantOutput,
          }),
        ),
        noRow, // bulk update marking poc_validation needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validSolutionConsultantAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "solution_consultant",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});

const mergedPocValidationOutput = {
  ...validValidationAgentOutput,
  evidenceSummary: {
    totalSourcesReferenced: 0,
    verifiedClaimsCount: 0,
    contradictedClaimsCount: 0,
    narrative: "n/a",
  },
  finalValidationDecision: "PROCEED_WITH_CHANGES",
  finalValidationDecisionReasoning: ["r"],
};

const approvedPhasesThroughPocValidation = [
  ...approvedPhasesThroughSolutionConsultant,
  phaseRow({
    id: "phase-9",
    phase_key: "poc_validation",
    status: "approved",
    output_data: mergedPocValidationOutput,
  }),
];

function dossierSectionSummary(importance: string = "MEDIUM") {
  return { summary: "s", importance };
}

const validReportGeneratorAgentOutput = {
  executiveSummary: {
    whatIsTheProblem: "p",
    whoHasTheProblem: "w",
    whyDoesItMatter: "m",
    whatAlreadyExists: "e",
    whatIsMissing: "i",
    whatOpportunityExists: "o",
    canItBeBuilt: "c",
    whatShouldBeBuilt: "b",
    whatIsTheBiggestRisk: "r",
    whatShouldTheTeamDoNext: "n",
  },
  problemContext: "c",
  problemImportantUnknowns: [],
  stakeholderNarrative: "s",
  importantPainLocalIds: ["pain-1"],
  painNarrative: "p",
  importantSolutionLocalIds: ["sol-1"],
  solutionLandscapeNarrative: "s",
  mostImportantGapId: "gap-1",
  gapNarrative: "g",
  opportunityNarrative: "o",
  innovationDirectionSummary: "i",
  aiJustificationSummary: "a",
  marketNarrative: "m",
  feasibilityNarrative: "f",
  solutionArchitectureSummary: "a",
  solutionDataFlowSummary: "d",
  pocNarrative: "p",
  implementationNarrative: "i",
  redTeamSelection: {
    strongestAttackPointId: "rt-1",
    weakestAssumptionId: "assume-1",
    biggestTechnicalRiskValidationId: "val-1",
    biggestMarketRiskValidationId: null,
    biggestAdoptionRiskValidationId: null,
    mostLikelyFailureId: "fm-1",
    mitigation: "m",
  },
  topJuryQuestionIds: ["jq-1"],
  jurySummaryNarrative: "j",
  validationPlanNarrative: "v",
  nextActionPlan: [
    { step: 1, action: "Interview 5 farmers", reason: "r", expectedOutput: "e", priority: "high" },
  ],
  decisionTrace: {
    problem: { finding: "f", criticalEvidence: [] },
    pain: { finding: "f", criticalEvidence: ["pain-1"] },
    gap: { finding: "f", criticalEvidence: ["gap-1"] },
    opportunity: { finding: "f", criticalEvidence: ["opp-1"] },
    market: { finding: "f", criticalEvidence: [] },
    feasibility: { finding: "f", criticalEvidence: [] },
    solution: { finding: "f", criticalEvidence: [] },
    validation: { finding: "f", criticalEvidence: ["assume-1"] },
  },
  majorReasons: ["The gap is real but validation is incomplete."],
  buildRecommendation: "BUILD_WITH_CHANGES",
  buildRecommendationReasoning: "r",
  sectionSummaries: {
    executiveSummary: dossierSectionSummary(),
    problem: dossierSectionSummary(),
    stakeholders: dossierSectionSummary(),
    pain: dossierSectionSummary(),
    existingSolutions: dossierSectionSummary(),
    gaps: dossierSectionSummary(),
    opportunity: dossierSectionSummary(),
    market: dossierSectionSummary(),
    feasibility: dossierSectionSummary("HIGH"),
    solution: dossierSectionSummary(),
    architecture: dossierSectionSummary(),
    poc: dossierSectionSummary(),
    implementation: dossierSectionSummary(),
    redTeam: dossierSectionSummary(),
    jury: dossierSectionSummary(),
    assumptions: dossierSectionSummary(),
    validation: dossierSectionSummary(),
    finalVerdict: dossierSectionSummary("CRITICAL"),
    nextActions: dossierSectionSummary(),
    evidence: dossierSectionSummary(),
  },
  finalConsultantMessage: "m",
};

describe("executePhaseAction: intelligence_dossier (Phase 10) depends on approved Phase 01, 02, 04, 05, 07, 08, 09 AND has-run Phase 03, 06", () => {
  it("blocks Phase 10 when Phase 09 has never run", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughSolutionConsultant)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/has not been run yet/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 10 when Phase 05 (an approval-gated upstream phase) is unapproved", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "awaiting_approval",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            output_data: mergedPocValidationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/awaiting your approval/);
    }
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("blocks Phase 10 when Phase 05 (an approval-gated upstream phase) is stale (needs_regeneration)", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughGapIntelligence,
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "needs_regeneration",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            output_data: mergedPocValidationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  // existing_solutions (Phase 03) and market_investment (Phase 06) both
  // have requiresApproval: false — the same unmodified gating applies
  // unchanged to Phase 10: both only have to have run, not be explicitly
  // approved.
  it("allows Phase 10 to run while Phase 06 is only awaiting approval, since market_investment doesn't require it", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughOpportunityInnovation,
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "awaiting_approval",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            output_data: mergedPocValidationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-10", phase_key: "intelligence_dossier", status: "running" })),
        row(phaseRow({ id: "phase-10", phase_key: "intelligence_dossier", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validReportGeneratorAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks Phase 10 when Phase 03 failed", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          phaseRow({
            id: "phase-1",
            phase_key: "problem_intelligence",
            status: "approved",
            output_data: validAnatomy,
          }),
          phaseRow({
            id: "phase-2",
            phase_key: "stakeholder_pain",
            status: "approved",
            output_data: mergedStakeholderPainOutput,
          }),
          phaseRow({
            id: "phase-3",
            phase_key: "existing_solutions",
            status: "failed",
          }),
          phaseRow({
            id: "phase-4",
            phase_key: "gap_intelligence",
            status: "approved",
            output_data: mergedGapIntelligenceOutput,
          }),
          phaseRow({
            id: "phase-5",
            phase_key: "opportunity_innovation",
            status: "approved",
            output_data: mergedOpportunityInnovationOutput,
          }),
          phaseRow({
            id: "phase-6",
            phase_key: "market_investment",
            status: "approved",
            output_data: mergedMarketInvestmentOutput,
          }),
          phaseRow({
            id: "phase-7",
            phase_key: "technical_feasibility",
            status: "approved",
            output_data: mergedTechnicalFeasibilityOutput,
          }),
          phaseRow({
            id: "phase-8",
            phase_key: "solution_consultant",
            status: "approved",
            output_data: mergedSolutionConsultantOutput,
          }),
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            output_data: mergedPocValidationOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("conflict");
      expect(result.message).toMatch(/failed/);
    }
  });

  it("runs Phase 10 successfully once Phase 01 through 09 have all cleared their gates", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughPocValidation)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-10", phase_key: "intelligence_dossier", status: "running" })),
        row(phaseRow({ id: "phase-10", phase_key: "intelligence_dossier", status: "awaiting_approval" })),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validReportGeneratorAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("awaiting_approval");
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(checkUsageMock).toHaveBeenCalledWith("user-1", "ai");
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
  });

  it("marks Phase 10 failed (not fabricated) when the Report Generator returns invalid_output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [rows(approvedPhasesThroughPocValidation)],
    });
    const admin = createMockDb({
      analysis_phases: [
        row(phaseRow({ id: "phase-10", phase_key: "intelligence_dossier", status: "running" })),
        noRow,
      ],
    });
    const provider = sequenceProvider([
      { status: "invalid_output", message: "bad json", raw: "{}" },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("error");
  });

  it("never spends an AI call once the usage limit is reached", async () => {
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
      analysis_phases: [rows(approvedPhasesThroughPocValidation)],
    });
    const admin = createMockDb({});
    const provider = sequenceProvider([]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "run",
      aiProvider: provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unavailable");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("returns not_found for a session the caller doesn't own", async () => {
    const supabase = createMockDb({ analysis_sessions: [noRow] });
    const admin = createMockDb({});

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "missing",
      phaseKey: "intelligence_dossier",
      action: "run",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("regenerates an approved Phase 10, archiving history and bumping the version", async () => {
    const priorOutput = {
      ...validReportGeneratorAgentOutput,
      finalConsultantMessage: "old",
    };
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughPocValidation,
          phaseRow({
            id: "phase-10",
            phase_key: "intelligence_dossier",
            status: "approved",
            version: 1,
            output_data: priorOutput,
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(
          phaseRow({
            id: "phase-10",
            phase_key: "intelligence_dossier",
            status: "running",
            version: 2,
          }),
        ),
        row(
          phaseRow({
            id: "phase-10",
            phase_key: "intelligence_dossier",
            status: "awaiting_approval",
            version: 2,
          }),
        ),
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validReportGeneratorAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "intelligence_dossier",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(2);
  });

  it("regenerating an approved Phase 09 flags an already-approved Phase 10 as needs_regeneration", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          ...approvedPhasesThroughSolutionConsultant,
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "approved",
            version: 1,
            output_data: mergedPocValidationOutput,
          }),
          phaseRow({
            id: "phase-10",
            phase_key: "intelligence_dossier",
            status: "approved",
            output_data: {
              ...validReportGeneratorAgentOutput,
              finalConsultantMessage: "old",
            },
          }),
        ]),
      ],
    });
    const admin = createMockDb({
      analysis_phase_history: [noRow],
      analysis_phases: [
        row(phaseRow({ id: "phase-9", phase_key: "poc_validation", status: "running", version: 2 })),
        row(
          phaseRow({
            id: "phase-9",
            phase_key: "poc_validation",
            status: "awaiting_approval",
            version: 2,
            output_data: mergedPocValidationOutput,
          }),
        ),
        noRow, // bulk update marking intelligence_dossier needs_regeneration
      ],
    });
    const provider = sequenceProvider([
      { status: "ok", model: "fake-model", data: validValidationAgentOutput },
    ]);

    const result = await executePhaseAction({
      supabase,
      admin,
      userId: "user-1",
      sessionId: "session-1",
      phaseKey: "poc_validation",
      action: "regenerate",
      aiProvider: provider,
    });

    expect(result.ok).toBe(true);
    const analysisPhaseCalls = (
      admin.from as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "analysis_phases");
    expect(analysisPhaseCalls).toHaveLength(3);
  });
});
