import { describe, expect, it } from "vitest";

import { publicEnvSchema, serverEnvSchema } from "./env.schema";

describe("publicEnvSchema", () => {
  it("accepts a valid public configuration", () => {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL Supabase URL", () => {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing publishable key", () => {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    });
    expect(result.success).toBe(false);
  });
});

describe("serverEnvSchema", () => {
  const base = {
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    GEMINI_API_KEY: "gemini-key",
  };

  it("applies defaults for optional fields", () => {
    const result = serverEnvSchema.parse(base);
    expect(result.GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(result.RESEARCH_PROVIDER).toBe("none");
    expect(result.USAGE_DAILY_AI_REQUEST_LIMIT).toBe(50);
  });

  it("rejects a missing GEMINI_API_KEY", () => {
    const result = serverEnvSchema.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown RESEARCH_PROVIDER", () => {
    const result = serverEnvSchema.safeParse({
      ...base,
      RESEARCH_PROVIDER: "google", // not in the allowed enum
    });
    expect(result.success).toBe(false);
  });

  it("coerces numeric limit strings from process.env", () => {
    const result = serverEnvSchema.parse({
      ...base,
      USAGE_DAILY_AI_REQUEST_LIMIT: "25",
    });
    expect(result.USAGE_DAILY_AI_REQUEST_LIMIT).toBe(25);
  });
});
