import "server-only";

import { runFeasibilityAgent } from "@/lib/agents/feasibility-agent";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { collectCitedSourceIds } from "@/lib/prism/evidence";
import type { ProjectMode } from "@/lib/prism/modes";

import {
  technicalFeasibilityAnalysisSchema,
  type TechnicalFeasibilityAnalysis,
} from "./schema";

export * from "./schema";

const POSITIVE_OVERALL_STATUSES = new Set(["HIGHLY_FEASIBLE", "FEASIBLE"]);

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/** Counts every object in the tree whose `status` is literally `"VERIFIED"` — matches both `richEvidenceClaim` and `marketNumber` shapes, since no other status enum in this schema uses that value. */
function countVerifiedClaims(value: unknown): number {
  let count = 0;
  if (Array.isArray(value)) {
    for (const item of value) count += countVerifiedClaims(item);
    return count;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.status === "VERIFIED") count += 1;
    for (const val of Object.values(obj)) count += countVerifiedClaims(val);
  }
  return count;
}

const MODE_FIELD: Record<ProjectMode, "hackathon" | "pbl" | "startup" | "research" | "zeroDegree"> = {
  HACKATHON: "hackathon",
  PBL: "pbl",
  STARTUP: "startup",
  RESEARCH: "research",
  ZERO_DEGREE: "zeroDegree",
};

/**
 * Phase 07 — Technical + Implementation Feasibility Intelligence. Runs
 * the single Feasibility Agent (per the phase catalog's own
 * `agents: ["feasibility_agent"]` roster entry), then enforces
 * everything Zod alone can't check:
 *
 * - Mode consistency: exactly the `modeFeasibility` block matching
 *   `context.mode` is populated, every other mode's block is `null`.
 * - Every cited source id resolves against Phase 06's own combined
 *   evidence source list (Phase 03 reused + Phase 06 researched) —
 *   an unresolvable citation is rejected as `invalid_output`.
 * - "No hidden blocker": `overallFeasibility` cannot be
 *   `HIGHLY_FEASIBLE`/`FEASIBLE` while a critical blocker exists, a
 *   technical dimension is `INFEASIBLE`, or a data requirement is
 *   `UNAVAILABLE` — a single critical dependency caps the result
 *   regardless of how well everything else scores, mechanically
 *   enforced rather than merely requested of the model.
 */
export async function runTechnicalFeasibilityPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<TechnicalFeasibilityAnalysis>> {
  const marketInvestment = marketInvestmentAnalysisSchema.safeParse(
    context.upstreamOutputs.market_investment,
  );
  if (!marketInvestment.success) {
    return {
      status: "error",
      message: "Phase 06 output could not be re-validated while merging Phase 07 output.",
    };
  }

  const agentResult = await runFeasibilityAgent(context, provider);
  if (agentResult.status !== "ok") {
    return agentResult;
  }

  const expectedField = MODE_FIELD[context.mode];
  if (agentResult.data.modeFeasibility.mode !== context.mode) {
    return invalidOutput(
      `Feasibility analysis was evaluated for mode "${agentResult.data.modeFeasibility.mode}" but this project is "${context.mode}".`,
      agentResult.data,
    );
  }
  for (const field of ["hackathon", "pbl", "startup", "research", "zeroDegree"] as const) {
    const populated = agentResult.data.modeFeasibility[field] !== null;
    if (field === expectedField && !populated) {
      return invalidOutput(
        `Feasibility analysis is missing the "${expectedField}" mode block required for project mode "${context.mode}".`,
        agentResult.data,
      );
    }
    if (field !== expectedField && populated) {
      return invalidOutput(
        `Feasibility analysis populated the "${field}" mode block, but this project's mode is "${context.mode}" — only "${expectedField}" should be populated.`,
        agentResult.data,
      );
    }
  }

  const knownSourceIds = new Set(
    marketInvestment.data.marketEvidence.sources.map((s) => s.sourceLocalId),
  );
  const citedIds = new Set<string>();
  collectCitedSourceIds(agentResult.data, citedIds);
  const badSource = [...citedIds].find((id) => !knownSourceIds.has(id));
  if (badSource) {
    return invalidOutput(
      `Feasibility analysis cites unknown source "${badSource}".`,
      agentResult.data,
    );
  }

  const hasInfeasibleTechnicalDimension = Object.values(agentResult.data.technicalFeasibility).some(
    (dimension) => dimension.status === "INFEASIBLE",
  );
  const hasUnavailableCriticalData = agentResult.data.dataFeasibility.requirements.some(
    (requirement) => requirement.availability === "UNAVAILABLE",
  );
  const hasCriticalBlockers = agentResult.data.criticalBlockers.length > 0;
  if (
    POSITIVE_OVERALL_STATUSES.has(agentResult.data.overallFeasibility.status) &&
    (hasInfeasibleTechnicalDimension || hasUnavailableCriticalData || hasCriticalBlockers)
  ) {
    return invalidOutput(
      `Overall feasibility cannot be "${agentResult.data.overallFeasibility.status}" while a critical blocker, an INFEASIBLE technical dimension, or an UNAVAILABLE required dataset exists — a single critical dependency caps the result regardless of how well everything else scores.`,
      agentResult.data,
    );
  }

  const { evidenceSummary: agentEvidenceSummary, ...restOfAgentOutput } = agentResult.data;

  const merged = {
    ...restOfAgentOutput,
    evidenceSummary: {
      totalSourcesReferenced: citedIds.size,
      verifiedClaimsCount: countVerifiedClaims(agentResult.data),
      narrative: agentEvidenceSummary.narrative,
    },
    criticalBlockersSummary: hasCriticalBlockers ? "BLOCKERS_IDENTIFIED" : "NONE_IDENTIFIED",
  };

  const validated = technicalFeasibilityAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 07 output failed schema validation: ${validated.error.message}`,
      merged,
    );
  }

  return {
    status: "ok",
    data: validated.data,
    model: agentResult.model,
    usage: agentResult.usage,
  };
}
