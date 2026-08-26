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

  it("returns not_implemented for a phase with no registered agent, without fabricating output", async () => {
    const supabase = createMockDb({
      analysis_sessions: [row(sessionRow)],
      projects: [row(projectRow)],
      problem_statements: [row(problemStatementRow)],
      analysis_phases: [
        rows([
          // Every implemented phase approved, unblocking
          // opportunity_innovation (Phase 05), which has no registered
          // agent yet.
          phaseRow({ id: "phase-1", phase_key: "problem_intelligence", status: "approved" }),
          phaseRow({ id: "phase-2", phase_key: "stakeholder_pain", status: "approved" }),
          phaseRow({ id: "phase-3", phase_key: "existing_solutions", status: "approved" }),
          phaseRow({ id: "phase-4", phase_key: "gap_intelligence", status: "approved" }),
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
