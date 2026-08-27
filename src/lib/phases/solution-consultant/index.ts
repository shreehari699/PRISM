import "server-only";

import { runSolutionConsultant } from "@/lib/agents/solution-consultant";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { selectLeadingOpportunity } from "@/lib/phases/market-investment";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { collectCitedSourceIds, countVerifiedClaims } from "@/lib/prism/evidence";
import type { ProjectMode } from "@/lib/prism/modes";

import {
  solutionConsultantAnalysisSchema,
  type SolutionConsultantAnalysis,
} from "./schema";

export * from "./schema";

/** Anti-overclaim guard on differentiation: "first"/"only"/"unique"/"world's first" language requires VERIFIED evidence — the same pattern Phase 05/06 apply to their own overclaim-prone fields. */
const OVERCLAIM_PATTERN = /\b(first|only|unique|world'?s first)\b/i;

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

const MODE_FIELD: Record<ProjectMode, "hackathon" | "pbl" | "startup" | "research" | "zeroDegree"> = {
  HACKATHON: "hackathon",
  PBL: "pbl",
  STARTUP: "startup",
  RESEARCH: "research",
  ZERO_DEGREE: "zeroDegree",
};

/**
 * Phase 08 — Solution Consultant & System Design Intelligence. Runs the
 * single Solution Consultant Agent (per the phase catalog's own
 * `agents: ["solution_consultant"]` roster entry), then enforces the
 * decision logic and cross-references Zod alone can't check:
 *
 * - Mode consistency: exactly the `modeSolutionPlan` block matching
 *   `context.mode` is populated, every other mode's block is `null` —
 *   the same mechanical check Phase 07 applies to `modeFeasibility`.
 * - `solution` is non-null if and only if Phase 05 has a leading
 *   opportunity — PRISM must not manufacture a solution when there's
 *   nothing real to build on, and conversely must actually recommend
 *   something once there is.
 * - The solution's `opportunityId` must be the selected leading
 *   opportunity specifically, and `validatedGapId` must resolve to a
 *   real, non-`NO_GAP_ESTABLISHED` Phase 04 gap.
 * - Every cited source resolves against Phase 06's combined evidence
 *   list; every `sourceRiskId` resolves against Phase 07's own risk
 *   register.
 * - Differentiation cannot claim "first"/"only"/"unique"/"world's
 *   first" without `VERIFIED` evidence.
 * - `aiArchitecture` is present if and only if `aiRole.classification`
 *   is anything other than `AI_NOT_REQUIRED`.
 * - If Phase 07's overall feasibility is `INFEASIBLE`, the solution
 *   reality check cannot be `RECOMMENDED_TO_BUILD`.
 * - Every Phase 07 critical blocker must be acknowledged by title.
 * - If Phase 07's confidence is `INSUFFICIENT_EVIDENCE`, the solution's
 *   own confidence cannot claim `STRONG`.
 */
export async function runSolutionConsultantPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<SolutionConsultantAnalysis>> {
  const gapIntelligence = gapIntelligenceAnalysisSchema.safeParse(
    context.upstreamOutputs.gap_intelligence,
  );
  const opportunityInnovation = opportunityInnovationAnalysisSchema.safeParse(
    context.upstreamOutputs.opportunity_innovation,
  );
  const marketInvestment = marketInvestmentAnalysisSchema.safeParse(
    context.upstreamOutputs.market_investment,
  );
  const technicalFeasibility = technicalFeasibilityAnalysisSchema.safeParse(
    context.upstreamOutputs.technical_feasibility,
  );
  if (
    !gapIntelligence.success ||
    !opportunityInnovation.success ||
    !marketInvestment.success ||
    !technicalFeasibility.success
  ) {
    return {
      status: "error",
      message:
        "Phase 04, 05, 06, and/or 07 output could not be re-validated while merging Phase 08 output.",
    };
  }

  const agentResult = await runSolutionConsultant(context, provider);
  if (agentResult.status !== "ok") {
    return agentResult;
  }

  const expectedField = MODE_FIELD[context.mode];
  if (agentResult.data.modeSolutionPlan.mode !== context.mode) {
    return invalidOutput(
      `Solution plan was evaluated for mode "${agentResult.data.modeSolutionPlan.mode}" but this project is "${context.mode}".`,
      agentResult.data,
    );
  }
  for (const field of ["hackathon", "pbl", "startup", "research", "zeroDegree"] as const) {
    const populated = agentResult.data.modeSolutionPlan[field] !== null;
    if (field === expectedField && !populated) {
      return invalidOutput(
        `Solution plan is missing the "${expectedField}" mode block required for project mode "${context.mode}".`,
        agentResult.data,
      );
    }
    if (field !== expectedField && populated) {
      return invalidOutput(
        `Solution plan populated the "${field}" mode block, but this project's mode is "${context.mode}" — only "${expectedField}" should be populated.`,
        agentResult.data,
      );
    }
  }

  const leadingOpportunity = selectLeadingOpportunity(opportunityInnovation.data);
  const { solution } = agentResult.data;

  if (leadingOpportunity === null && solution !== null) {
    return invalidOutput(
      "Phase 05 identified no meaningful opportunity, but the Solution Consultant produced a solution anyway — a solution must not be manufactured when there is nothing to build on.",
      agentResult.data,
    );
  }
  if (leadingOpportunity !== null && solution === null) {
    return invalidOutput(
      "Phase 05 identified a leading opportunity, but the Solution Consultant returned no solution.",
      agentResult.data,
    );
  }

  if (solution !== null && leadingOpportunity !== null) {
    if (solution.opportunityId !== leadingOpportunity.opportunityId) {
      return invalidOutput(
        `Solution addresses opportunity "${solution.opportunityId}", but the selected leading opportunity is "${leadingOpportunity.opportunityId}".`,
        agentResult.data,
      );
    }

    const gap = gapIntelligence.data.gapCandidates.find((g) => g.gapId === solution.validatedGapId);
    if (!gap) {
      return invalidOutput(
        `Solution references unknown gap "${solution.validatedGapId}".`,
        agentResult.data,
      );
    }
    if (gap.gapState === "NO_GAP_ESTABLISHED") {
      return invalidOutput(
        `Solution is grounded in gap "${solution.validatedGapId}", but that gap is NO_GAP_ESTABLISHED — an existing solution already covers it.`,
        agentResult.data,
      );
    }

    if (
      solution.differentiation.overallClaim.status !== "VERIFIED" &&
      OVERCLAIM_PATTERN.test(solution.differentiation.overallClaim.claim)
    ) {
      return invalidOutput(
        "Solution claims a superlative differentiation (\"first\"/\"only\"/\"unique\"/\"world's first\") without VERIFIED evidence — must be phrased as a potential or identified differentiation instead.",
        agentResult.data,
      );
    }

    const aiArchitecturePresent = agentResult.data.aiArchitecture !== null;
    const aiGenuinelyInvolved = solution.aiRole.classification !== "AI_NOT_REQUIRED";
    if (aiGenuinelyInvolved && !aiArchitecturePresent) {
      return invalidOutput(
        `Solution's AI role is "${solution.aiRole.classification}" but no aiArchitecture was provided.`,
        agentResult.data,
      );
    }
    if (!aiGenuinelyInvolved && aiArchitecturePresent) {
      return invalidOutput(
        "Solution's AI role is AI_NOT_REQUIRED, but an aiArchitecture was provided anyway.",
        agentResult.data,
      );
    }

    for (const risk of solution.risks) {
      if (
        risk.sourceRiskId !== null &&
        !technicalFeasibility.data.riskRegister.some((r) => r.riskId === risk.sourceRiskId)
      ) {
        return invalidOutput(
          `Solution risk "${risk.riskId}" cites unknown Phase 07 risk "${risk.sourceRiskId}".`,
          agentResult.data,
        );
      }
    }
  }

  if (technicalFeasibility.data.overallFeasibility.status === "INFEASIBLE") {
    if (agentResult.data.solutionRealityCheck.status === "RECOMMENDED_TO_BUILD") {
      return invalidOutput(
        "Phase 07's overall feasibility is INFEASIBLE — the solution reality check cannot be RECOMMENDED_TO_BUILD.",
        agentResult.data,
      );
    }
  }

  const missingAcknowledgment = technicalFeasibility.data.criticalBlockers.find(
    (blocker) =>
      !agentResult.data.acknowledgedCriticalBlockers.some((ack) =>
        ack.toLowerCase().includes(blocker.title.toLowerCase()),
      ),
  );
  if (missingAcknowledgment) {
    return invalidOutput(
      `Phase 07 identified a critical blocker ("${missingAcknowledgment.title}") that the solution never acknowledged.`,
      agentResult.data,
    );
  }

  if (
    technicalFeasibility.data.confidenceSummary.overallConfidence === "INSUFFICIENT_EVIDENCE" &&
    agentResult.data.confidenceSummary.overallConfidence === "STRONG"
  ) {
    return invalidOutput(
      "Phase 07's evidence confidence is INSUFFICIENT_EVIDENCE — the solution cannot claim STRONG confidence.",
      agentResult.data,
    );
  }

  const knownSourceIds = new Set(
    marketInvestment.data.marketEvidence.sources.map((s) => s.sourceLocalId),
  );
  const citedIds = new Set<string>();
  collectCitedSourceIds(agentResult.data, citedIds);
  const badSource = [...citedIds].find((id) => !knownSourceIds.has(id));
  if (badSource) {
    return invalidOutput(
      `Solution consultant output cites unknown source "${badSource}".`,
      agentResult.data,
    );
  }

  const mergedSolution = solution
    ? {
        ...solution,
        coreFeatures: agentResult.data.featureScope?.mustHave ?? [],
        mustHaveFeatures: agentResult.data.featureScope?.mustHave ?? [],
        futureFeatures: agentResult.data.featureScope?.future ?? [],
      }
    : null;

  const { evidenceSummary: agentEvidenceSummary, ...restOfAgentOutput } = agentResult.data;

  const merged = {
    ...restOfAgentOutput,
    solution: mergedSolution,
    evidenceSummary: {
      totalSourcesReferenced: citedIds.size,
      verifiedClaimsCount: countVerifiedClaims(agentResult.data),
      narrative: agentEvidenceSummary.narrative,
    },
  };

  const validated = solutionConsultantAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 08 output failed schema validation: ${validated.error.message}`,
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
