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
          // Both implemented phases approved, unblocking existing_solutions
          // (Phase 03), which has no registered agent yet.
          phaseRow({ id: "phase-1", phase_key: "problem_intelligence", status: "approved" }),
          phaseRow({ id: "phase-2", phase_key: "stakeholder_pain", status: "approved" }),
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
