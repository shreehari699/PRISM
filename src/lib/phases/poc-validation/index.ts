import "server-only";

import { runValidationAgent } from "@/lib/agents/validation-agent";
import type { BuildDecision } from "@/lib/agents/validation-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { solutionConsultantAnalysisSchema } from "@/lib/phases/solution-consultant/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";
import { collectCitedSourceIds } from "@/lib/prism/evidence";

import { pocValidationAnalysisSchema, type FinalValidationDecision, type PocValidationAnalysis } from "./schema";

export * from "./schema";

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/** Best (0) to worst (3) — mirrors `buildDecisionSchema`'s own order. */
const BUILD_LADDER: Record<BuildDecision, number> = {
  BUILD: 0,
  BUILD_WITH_CHANGES: 1,
  VALIDATE_BEFORE_BUILD: 2,
  DO_NOT_BUILD: 3,
};

/** Same ladder, expressed as the composer's own five-way decision (index 0-3; INSUFFICIENT_EVIDENCE is off-ladder, only reachable via the solution-absent branch below). */
const LADDER_DECISION: readonly FinalValidationDecision[] = [
  "VALIDATED_TO_PROCEED",
  "PROCEED_WITH_CHANGES",
  "VALIDATE_BEFORE_BUILD",
  "DO_NOT_BUILD",
];

/**
 * Phase 09 — Validation, Adversarial Review & Jury Challenge. Runs the
 * single Validation Agent (per the phase catalog's own
 * `agents: ["validation_agent"]` roster entry), then enforces the
 * cross-references and the deterministic decision engine Zod alone
 * can't check:
 *
 * - `criticalAssumption.assumptionId` and `redTeamReview.mostFragileAssumptionId`
 *   (when set) must resolve to a real entry in the agent's own
 *   `assumptionRegister` — never a newly invented "dangerous assumption".
 * - Coherence with Phase 08: if Phase 08 recommended no solution, the
 *   agent's `buildRecommendation` must be DO_NOT_BUILD; `pocValidation.status`
 *   must be NO_POC_DEFINED if and only if Phase 08 actually defined no
 *   POC; an empty `successMetrics` list cannot be reviewed as
 *   well-defined/measurable/relevant/realistic.
 * - Confidence honesty: `overallConfidence` cannot be HIGH while a
 *   validation claim is CONTRADICTED or the critical assumption itself
 *   is UNSUPPORTED/CONTRADICTED.
 * - Every cited source resolves against Phase 06's combined evidence
 *   list, exactly like Phase 07/08.
 * - `finalValidationDecision` is computed here, deterministically, from
 *   Phase 07/08's actual state — never taken from the model's own
 *   `buildRecommendation` unmodified. See the inline decision engine
 *   below for the exact rule order.
 */
export async function runPocValidationPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<PocValidationAnalysis>> {
  const marketInvestment = marketInvestmentAnalysisSchema.safeParse(
    context.upstreamOutputs.market_investment,
  );
  const technicalFeasibility = technicalFeasibilityAnalysisSchema.safeParse(
    context.upstreamOutputs.technical_feasibility,
  );
  const solutionConsultant = solutionConsultantAnalysisSchema.safeParse(
    context.upstreamOutputs.solution_consultant,
  );
  if (!marketInvestment.success || !technicalFeasibility.success || !solutionConsultant.success) {
    return {
      status: "error",
      message:
        "Phase 06, 07, and/or 08 output could not be re-validated while merging Phase 09 output.",
    };
  }

  const agentResult = await runValidationAgent(context, provider);
  if (agentResult.status !== "ok") {
    return agentResult;
  }

  const {
    validationClaims,
    assumptionRegister,
    redTeamReview,
    criticalAssumption,
    pocValidation,
    successMetricsReview,
    buildRecommendation,
    confidenceSummary,
  } = agentResult.data;

  const criticalAssumptionEntry = assumptionRegister.find(
    (a) => a.assumptionId === criticalAssumption.assumptionId,
  );
  if (!criticalAssumptionEntry) {
    return invalidOutput(
      `criticalAssumption references unknown assumption "${criticalAssumption.assumptionId}" — it must be selected from the agent's own assumptionRegister.`,
      agentResult.data,
    );
  }

  if (
    redTeamReview.mostFragileAssumptionId !== null &&
    !assumptionRegister.some((a) => a.assumptionId === redTeamReview.mostFragileAssumptionId)
  ) {
    return invalidOutput(
      `Red team review names unknown assumption "${redTeamReview.mostFragileAssumptionId}" as the most fragile.`,
      agentResult.data,
    );
  }

  const solution = solutionConsultant.data.solution;

  if (solution === null && buildRecommendation !== "DO_NOT_BUILD") {
    return invalidOutput(
      `Phase 08 recommended no solution, but buildRecommendation was "${buildRecommendation}" instead of DO_NOT_BUILD.`,
      agentResult.data,
    );
  }

  const pocDefined = solutionConsultant.data.pocDefinition !== null;
  if (!pocDefined && pocValidation.status !== "NO_POC_DEFINED") {
    return invalidOutput(
      "Phase 08 defined no POC, but pocValidation.status was not NO_POC_DEFINED.",
      agentResult.data,
    );
  }
  if (pocDefined && pocValidation.status === "NO_POC_DEFINED") {
    return invalidOutput(
      "Phase 08 defined a POC, but pocValidation.status claimed NO_POC_DEFINED.",
      agentResult.data,
    );
  }

  if (solutionConsultant.data.successMetrics.length === 0) {
    const { wellDefined, measurable, relevant, realistic } = successMetricsReview;
    if (wellDefined || measurable || relevant || realistic) {
      return invalidOutput(
        "Phase 08 proposed no success metrics, but successMetricsReview claims they are well-defined, measurable, relevant, or realistic.",
        agentResult.data,
      );
    }
  }

  const hasContradictedClaim = validationClaims.some((c) => c.evidenceStatus === "CONTRADICTED");
  const criticalAssumptionWeak =
    criticalAssumptionEntry.status === "UNSUPPORTED" || criticalAssumptionEntry.status === "CONTRADICTED";
  if (confidenceSummary.overallConfidence === "HIGH" && (hasContradictedClaim || criticalAssumptionWeak)) {
    return invalidOutput(
      "Contradicted evidence exists or the critical assumption is unsupported/contradicted — overallConfidence cannot be HIGH.",
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
    return invalidOutput(`Validation output cites unknown source "${badSource}".`, agentResult.data);
  }

  // --- Decision engine: deterministic, never overridden by the model. ---
  const coreProblemContradicted = validationClaims.some(
    (c) =>
      (c.domain === "PROBLEM_VALIDATION" || c.domain === "PAIN_VALIDATION") &&
      c.evidenceStatus === "CONTRADICTED",
  );

  const reasoning: string[] = [];
  let finalDecision: FinalValidationDecision;

  if (solution === null) {
    finalDecision =
      solutionConsultant.data.solutionRealityCheck.status === "NOT_RECOMMENDED"
        ? "DO_NOT_BUILD"
        : "INSUFFICIENT_EVIDENCE";
    reasoning.push(
      `Phase 08 recommended no solution (its reality check was ${solutionConsultant.data.solutionRealityCheck.status}).`,
    );
  } else if (technicalFeasibility.data.overallFeasibility.status === "INFEASIBLE") {
    finalDecision = "DO_NOT_BUILD";
    reasoning.push("Phase 07's overall feasibility is INFEASIBLE.");
  } else if (coreProblemContradicted) {
    finalDecision = "DO_NOT_BUILD";
    reasoning.push("Evidence directly contradicts the core problem or its pain.");
  } else {
    let floor = 0; // best case: VALIDATED_TO_PROCEED

    if (criticalAssumptionWeak) {
      floor = Math.max(floor, 2);
      reasoning.push(
        `The critical assumption ("${criticalAssumptionEntry.assumption}") is ${criticalAssumptionEntry.status} — at least VALIDATE_BEFORE_BUILD.`,
      );
    }

    if (technicalFeasibility.data.criticalBlockers.length > 0) {
      floor = Math.max(floor, 1);
      reasoning.push(
        "Phase 07 has unresolved critical blockers — the decision cannot be VALIDATED_TO_PROCEED.",
      );
    }

    const feasibleOrBetter =
      technicalFeasibility.data.overallFeasibility.status === "FEASIBLE" ||
      technicalFeasibility.data.overallFeasibility.status === "HIGHLY_FEASIBLE";
    if (feasibleOrBetter && confidenceSummary.overallConfidence !== "HIGH") {
      floor = Math.max(floor, confidenceSummary.overallConfidence === "MEDIUM" ? 1 : 2);
      reasoning.push(
        `The solution is technically feasible but validation confidence is only ${confidenceSummary.overallConfidence} — strategically weak.`,
      );
    }

    const agentProposed = BUILD_LADDER[buildRecommendation];
    const finalPosition = Math.max(agentProposed, floor);
    finalDecision = LADDER_DECISION[finalPosition];

    if (reasoning.length === 0) {
      reasoning.push(
        `No deterministic floor applied; following the validation agent's own buildRecommendation (${buildRecommendation}).`,
      );
    }
  }

  const merged = {
    ...agentResult.data,
    evidenceSummary: {
      totalSourcesReferenced: citedIds.size,
      verifiedClaimsCount: validationClaims.filter((c) => c.evidenceStatus === "VERIFIED").length,
      contradictedClaimsCount: validationClaims.filter((c) => c.evidenceStatus === "CONTRADICTED")
        .length,
      narrative: agentResult.data.evidenceSummary.narrative,
    },
    finalValidationDecision: finalDecision,
    finalValidationDecisionReasoning: reasoning,
  };

  const validated = pocValidationAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 09 output failed schema validation: ${validated.error.message}`,
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
