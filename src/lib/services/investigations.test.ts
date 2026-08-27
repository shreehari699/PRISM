import { describe, expect, it } from "vitest";

import { PHASE_KEYS } from "@/lib/prism/phases";

import { createMockDb, dbError, noRow, row, rows } from "./test-support/mock-db";
import {
  createInvestigation,
  createInvestigationInputSchema,
  getSessionOverview,
  listInvestigations,
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

const testUser = { email: "farmer-app@example.com", fullName: "Asha Rao" };

describe("createInvestigation", () => {
  it("ensures the caller's own profile exists, then creates a project, problem statement, and session in sequence", async () => {
    const db = createMockDb({
      profiles: [noRow],
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

    const result = await createInvestigation(db, "user-1", validInput, testUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        projectId: "project-1",
        problemStatementId: "ps-1",
        sessionId: "session-1",
      });
    }
  });

  it("returns a typed error if profile provisioning fails, without touching projects at all", async () => {
    const db = createMockDb({
      profiles: [dbError("new row violates row-level security policy")],
    });

    const result = await createInvestigation(db, "user-1", validInput, testUser);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/row-level security/);
    }
  });

  it("returns a typed error if project creation fails, without touching later tables", async () => {
    const db = createMockDb({
      profiles: [noRow],
      projects: [dbError("permission denied")],
    });

    const result = await createInvestigation(db, "user-1", validInput, testUser);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("error");
      expect(result.message).toMatch(/permission denied/);
    }
  });

  it("returns a typed error if the problem statement insert fails", async () => {
    const db = createMockDb({
      profiles: [noRow],
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

    const result = await createInvestigation(db, "user-1", validInput, testUser);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/check constraint violated/);
    }
  });
});

describe("listInvestigations", () => {
  it("returns an empty list for a user with no projects, without querying further tables", async () => {
    const db = createMockDb({ projects: [rows([])] });

    const result = await listInvestigations(db, "user-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it("summarizes a session with no dossier yet as an in-progress investigation with no verdict", async () => {
    const db = createMockDb({
      projects: [
        rows([
          {
            id: "project-1",
            user_id: "user-1",
            name: "Crop Pricing Transparency",
            mode: "HACKATHON",
            status: "active",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      analysis_sessions: [
        rows([
          {
            id: "session-1",
            project_id: "project-1",
            problem_statement_id: "ps-1",
            current_phase_key: "stakeholder_pain",
            status: "in_progress",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      problem_statements: [
        rows([
          {
            id: "ps-1",
            project_id: "project-1",
            raw_text: validInput.rawText,
            input_method: "paste",
            source_file_url: null,
            discovery_parameters: null,
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      analysis_phases: [rows([])],
    });

    const result = await listInvestigations(db, "user-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        {
          sessionId: "session-1",
          projectId: "project-1",
          projectName: "Crop Pricing Transparency",
          problemPreview: validInput.rawText,
          mode: "HACKATHON",
          sessionStatus: "in_progress",
          currentPhaseKey: "stakeholder_pain",
          createdAt: now,
          latestVerdict: null,
        },
      ]);
    }
  });

  it("never surfaces a verdict from a dossier phase whose output_data doesn't parse", async () => {
    const db = createMockDb({
      projects: [
        rows([
          {
            id: "project-1",
            user_id: "user-1",
            name: "Crop Pricing Transparency",
            mode: "HACKATHON",
            status: "active",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      analysis_sessions: [
        rows([
          {
            id: "session-1",
            project_id: "project-1",
            problem_statement_id: "ps-1",
            current_phase_key: "intelligence_dossier",
            status: "in_progress",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      problem_statements: [
        rows([
          {
            id: "ps-1",
            project_id: "project-1",
            raw_text: validInput.rawText,
            input_method: "paste",
            source_file_url: null,
            discovery_parameters: null,
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
      analysis_phases: [
        rows([
          {
            id: "phase-1",
            session_id: "session-1",
            project_id: "project-1",
            phase_key: "intelligence_dossier",
            status: "approved",
            version: 1,
            input_data: null,
            output_data: { incomplete: true },
            error_message: null,
            approved_at: now,
            approved_by: "user-1",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
    });

    const result = await listInvestigations(db, "user-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0]?.latestVerdict).toBeNull();
  });

  it("returns a typed error if the projects query fails", async () => {
    const db = createMockDb({ projects: [dbError("connection reset")] });

    const result = await listInvestigations(db, "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/connection reset/);
  });
});

describe("getSessionOverview", () => {
  it("returns not_found when the session doesn't exist (or isn't the caller's)", async () => {
    const db = createMockDb({ analysis_sessions: [noRow] });

    const result = await getSessionOverview(db, "session-missing");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("fills every phase without a row as not_started, in catalog order", async () => {
    const db = createMockDb({
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
      projects: [
        row({
          id: "project-1",
          user_id: "user-1",
          name: "Crop Pricing Transparency",
          mode: "HACKATHON",
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
          input_method: "paste",
          source_file_url: null,
          discovery_parameters: null,
          created_at: now,
          updated_at: now,
        }),
      ],
      analysis_phases: [rows([])],
    });

    const result = await getSessionOverview(db, "session-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phases).toHaveLength(PHASE_KEYS.length);
      expect(result.data.phases.every((p) => p.status === "not_started")).toBe(true);
      expect(result.data.phases.map((p) => p.phaseKey)).toEqual(PHASE_KEYS);
    }
  });

  it("uses the real row for a phase that has already run", async () => {
    const db = createMockDb({
      analysis_sessions: [
        row({
          id: "session-1",
          project_id: "project-1",
          problem_statement_id: "ps-1",
          current_phase_key: "stakeholder_pain",
          status: "in_progress",
          created_at: now,
          updated_at: now,
        }),
      ],
      projects: [
        row({
          id: "project-1",
          user_id: "user-1",
          name: "Crop Pricing Transparency",
          mode: "HACKATHON",
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
          input_method: "paste",
          source_file_url: null,
          discovery_parameters: null,
          created_at: now,
          updated_at: now,
        }),
      ],
      analysis_phases: [
        rows([
          {
            id: "phase-1",
            session_id: "session-1",
            project_id: "project-1",
            phase_key: "problem_intelligence",
            status: "approved",
            version: 1,
            input_data: null,
            output_data: { restatement: "done" },
            error_message: null,
            approved_at: now,
            approved_by: "user-1",
            created_at: now,
            updated_at: now,
          },
        ]),
      ],
    });

    const result = await getSessionOverview(db, "session-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const problemPhase = result.data.phases.find((p) => p.phaseKey === "problem_intelligence");
      expect(problemPhase?.status).toBe("approved");
      expect(problemPhase?.outputData).toEqual({ restatement: "done" });
    }
  });
});
