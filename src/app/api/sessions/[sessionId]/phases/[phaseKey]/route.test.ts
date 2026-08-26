import { describe, expect, it, vi } from "vitest";

const createUntypedClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createUntypedClient: () => createUntypedClientMock(),
}));

const createUntypedAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createUntypedAdminClient: () => createUntypedAdminClientMock(),
}));

const executePhaseActionMock = vi.fn();
const getPhaseStateMock = vi.fn();
vi.mock("@/lib/services/phase-engine", () => ({
  executePhaseAction: (...args: unknown[]) => executePhaseActionMock(...args),
  getPhaseState: (...args: unknown[]) => getPhaseStateMock(...args),
}));

const { GET, POST } = await import("./route");

function fakeSupabase(user: { id: string } | null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

function params(sessionId: string, phaseKey: string) {
  return { params: Promise.resolve({ sessionId, phaseKey }) };
}

describe("GET /api/sessions/[sessionId]/phases/[phaseKey]", () => {
  it("returns 400 for an unrecognized phase key", async () => {
    const response = await GET(
      new Request("http://localhost"),
      params("session-1", "not_a_phase"),
    );
    expect(response.status).toBe(400);
    expect(getPhaseStateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase(null));
    const response = await GET(
      new Request("http://localhost"),
      params("session-1", "problem_intelligence"),
    );
    expect(response.status).toBe(401);
  });

  it("returns the phase state on success", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    getPhaseStateMock.mockResolvedValue({
      ok: true,
      data: { phaseKey: "problem_intelligence", status: "not_started" },
    });

    const response = await GET(
      new Request("http://localhost"),
      params("session-1", "problem_intelligence"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("not_started");
  });

  it("maps not_found to a 404", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    getPhaseStateMock.mockResolvedValue({
      ok: false,
      code: "not_found",
      message: "Analysis session not found.",
    });

    const response = await GET(
      new Request("http://localhost"),
      params("missing", "problem_intelligence"),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/sessions/[sessionId]/phases/[phaseKey]", () => {
  function postRequest(body: unknown) {
    return new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 for an unrecognized phase key before checking auth", async () => {
    const response = await POST(
      postRequest({ action: "run" }),
      params("session-1", "not_a_phase"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase(null));
    const response = await POST(
      postRequest({ action: "run" }),
      params("session-1", "problem_intelligence"),
    );
    expect(response.status).toBe(401);
    expect(executePhaseActionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid action", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    const response = await POST(
      postRequest({ action: "delete_everything" }),
      params("session-1", "problem_intelligence"),
    );
    expect(response.status).toBe(400);
    expect(executePhaseActionMock).not.toHaveBeenCalled();
  });

  it("dispatches a valid action to the phase engine and returns its result", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    createUntypedAdminClientMock.mockReturnValue({ admin: true });
    executePhaseActionMock.mockResolvedValue({
      ok: true,
      data: { phaseKey: "problem_intelligence", status: "awaiting_approval" },
    });

    const response = await POST(
      postRequest({ action: "run" }),
      params("session-1", "problem_intelligence"),
    );

    expect(response.status).toBe(200);
    expect(executePhaseActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        phaseKey: "problem_intelligence",
        action: "run",
      }),
    );
  });

  it("maps a not_implemented result to 501", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    executePhaseActionMock.mockResolvedValue({
      ok: false,
      code: "not_implemented",
      message: "The agent for this phase has not been implemented yet.",
    });

    const response = await POST(
      postRequest({ action: "run" }),
      params("session-1", "stakeholder_pain"),
    );
    expect(response.status).toBe(501);
  });

  it("maps a conflict result to 409", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    executePhaseActionMock.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "Already has output.",
    });

    const response = await POST(
      postRequest({ action: "run" }),
      params("session-1", "problem_intelligence"),
    );
    expect(response.status).toBe(409);
  });
});
