import { describe, expect, it } from "vitest";

import { createMockDb, dbError, row } from "./test-support/mock-db";
import {
  createInvestigation,
  createInvestigationInputSchema,
} from "./investigations";

const validInput = {
  name: "Crop Pricing Transparency",
  mode: "HACKATHON" as const,
  rawText: "Smallholder farmers cannot see real-time crop prices before harvest.",
  inputMethod: "paste" as const,
};

const now = new Date().toISOString();

describe("createInvestigationInputSchema", () => {
  it("accepts a well-formed input", () => {
    expect(createInvestigationInputSchema.safeParse(validInput).success).toBe(
      true,
    );
  });

  it("rejects a problem statement shorter than 20 characters", () => {
    const result = createInvestigationInputSchema.safeParse({
      ...validInput,
      rawText: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized project mode", () => {
    const result = createInvestigationInputSchema.safeParse({
      ...validInput,
      mode: "FREESTYLE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL sourceFileUrl", () => {
    const result = createInvestigationInputSchema.safeParse({
      ...validInput,
      sourceFileUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("createInvestigation", () => {
  it("creates a project, problem statement, and session in sequence", async () => {
    const db = createMockDb({
      projects: [
        row({
          id: "project-1",
          user_id: "user-1",
          name: validInput.name,
          mode: validInput.mode,
          status: "active",
          created_at: now,
          updated_at: now,
        }),
      ],
      problem_statements: [
        row({
          id: "ps-1",
          project_id: "project-1",
          raw_text: validInput.rawText,
          input_method: validInput.inputMethod,
          source_file_url: null,
          discovery_parameters: null,
          created_at: now,
          updated_at: now,
        }),
      ],
      analysis_sessions: [
        row({
          id: "session-1",
          project_id: "project-1",
          problem_statement_id: "ps-1",
          current_phase_key: "problem_intelligence",
          status: "in_progress",
          created_at: now,
          updated_at: now,
        }),
      ],
    });

    const result = await createInvestigation(db, "user-1", validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        projectId: "project-1",
        problemStatementId: "ps-1",
        sessionId: "session-1",
      });
    }
  });

  it("returns a typed error if project creation fails, without touching later tables", async () => {
    const db = createMockDb({
      projects: [dbError("permission denied")],
    });

    const result = await createInvestigation(db, "user-1", validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/permission denied/);
    }
  });

  it("returns a typed error if the problem statement insert fails", async () => {
    const db = createMockDb({
      projects: [
        row({
          id: "project-1",
          user_id: "user-1",
          name: validInput.name,
          mode: validInput.mode,
          status: "active",
          created_at: now,
          updated_at: now,
        }),
      ],
      problem_statements: [dbError("check constraint violated")],
    });

    const result = await createInvestigation(db, "user-1", validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/check constraint violated/);
    }
  });
});
