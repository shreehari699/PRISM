import { describe, expect, it, vi } from "vitest";

const createUntypedClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createUntypedClient: () => createUntypedClientMock(),
}));

const createInvestigationMock = vi.fn();
vi.mock("@/lib/services/investigations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/services/investigations")>();
  return { ...actual, createInvestigation: (...args: unknown[]) => createInvestigationMock(...args) };
});

const { POST } = await import("./route");

function fakeSupabase(user: { id: string } | null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/investigations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Crop Pricing Transparency",
  mode: "HACKATHON",
  rawText: "Smallholder farmers cannot see real-time crop prices before harvest.",
  inputMethod: "paste",
};

describe("POST /api/investigations", () => {
  it("returns 401 when there is no authenticated user", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase(null));

    const response = await POST(jsonRequest(validBody));
    expect(response.status).toBe(401);
    expect(createInvestigationMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't valid JSON", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));

    const badRequest = new Request("http://localhost/api/investigations", {
      method: "POST",
      body: "not json",
    });
    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it("returns 400 for a body that fails schema validation", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));

    const response = await POST(jsonRequest({ ...validBody, rawText: "short" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues).toBeDefined();
    expect(createInvestigationMock).not.toHaveBeenCalled();
  });

  it("returns 201 and the created ids on success", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    createInvestigationMock.mockResolvedValue({
      ok: true,
      data: { projectId: "p1", problemStatementId: "ps1", sessionId: "s1" },
    });

    const response = await POST(jsonRequest(validBody));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ projectId: "p1", problemStatementId: "ps1", sessionId: "s1" });
    expect(createInvestigationMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({ name: validBody.name }),
      expect.objectContaining({ email: "", fullName: null }),
    );
  });

  it("maps a service failure to the matching HTTP status", async () => {
    createUntypedClientMock.mockResolvedValue(fakeSupabase({ id: "user-1" }));
    createInvestigationMock.mockResolvedValue({
      ok: false,
      code: "error",
      message: "Failed to create project: permission denied",
    });

    const response = await POST(jsonRequest(validBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/permission denied/);
  });

  it("passes the authenticated user's real email and full name through for profile provisioning", async () => {
    createUntypedClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "consultant@example.com",
              user_metadata: { full_name: "Asha Rao" },
            },
          },
          error: null,
        }),
      },
    });
    createInvestigationMock.mockResolvedValue({
      ok: true,
      data: { projectId: "p1", problemStatementId: "ps1", sessionId: "s1" },
    });

    await POST(jsonRequest(validBody));

    expect(createInvestigationMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.anything(),
      { email: "consultant@example.com", fullName: "Asha Rao" },
    );
  });
});
