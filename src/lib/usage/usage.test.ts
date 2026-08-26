import { describe, expect, it, vi, beforeEach } from "vitest";

const rpcMock = vi.fn().mockResolvedValue({ error: null });
const maybeSingleMock = vi.fn();

function chain() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = maybeSingleMock;
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createUntypedAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => chain()),
    rpc: rpcMock,
  })),
}));

vi.mock("@/lib/config/env.server", () => ({
  getServerEnv: vi.fn().mockReturnValue({
    USAGE_DAILY_AI_REQUEST_LIMIT: 5,
    USAGE_MONTHLY_AI_REQUEST_LIMIT: 100,
    USAGE_DAILY_RESEARCH_REQUEST_LIMIT: 3,
  }),
}));

const { checkUsage, recordUsage } = await import("./index");

describe("checkUsage", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    rpcMock.mockClear();
  });

  it("allows the request when usage is below every limit", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ai_requests: 1, research_requests: 0, tokens_used: 500 },
      error: null,
    });

    const result = await checkUsage("user-1", "ai");
    expect(result.allowed).toBe(true);
    expect(result.safeMode).toBe(false);
  });

  it("enters safe mode once the daily limit is reached", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ai_requests: 5, research_requests: 0, tokens_used: 9000 },
      error: null,
    });

    const result = await checkUsage("user-1", "ai");
    expect(result.allowed).toBe(false);
    expect(result.safeMode).toBe(true);
    expect(result.reason).toMatch(/Daily ai request limit reached/);
  });

  it("treats a missing usage row as zero usage rather than erroring", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await checkUsage("new-user", "research");
    expect(result.allowed).toBe(true);
    expect(result.remaining.daily).toBe(3);
  });

  it("throws rather than silently proceeding when the database read fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });

    await expect(checkUsage("user-1", "ai")).rejects.toThrow(
      /Failed to read usage_tracking/,
    );
  });
});

describe("recordUsage", () => {
  it("increments both the daily and monthly period via the atomic RPC", async () => {
    rpcMock.mockResolvedValue({ error: null });

    await recordUsage("user-1", "ai", 250);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledWith(
      "increment_usage",
      expect.objectContaining({
        p_user_id: "user-1",
        p_period_type: "daily",
        p_ai_requests: 1,
        p_tokens: 250,
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "increment_usage",
      expect.objectContaining({ p_period_type: "monthly" }),
    );
  });

  it("throws if the increment RPC fails, so callers know quota wasn't recorded", async () => {
    rpcMock.mockResolvedValue({ error: { message: "db unreachable" } });

    await expect(recordUsage("user-1", "ai")).rejects.toThrow(
      /Failed to record/,
    );
  });
});
