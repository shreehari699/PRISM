import "server-only";

import { runPainAnalyst } from "@/lib/agents/pain-analyst";
import { runStakeholderAnalyst } from "@/lib/agents/stakeholder-analyst";
import { combineUsage, getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";

import {
  stakeholderPainAnalysisSchema,
  type Stakeholder,
  type StakeholderPainAnalysis,
} from "./schema";

export * from "./schema";

/**
 * Phase 02 — Stakeholder & Pain Intelligence. Runs the Stakeholder
 * Analyst, then the Pain Analyst grounded in its output, then merges
 * the two into one validated result. The phase engine
 * (src/lib/services/phase-engine.ts) only ever sees this as a single
 * `AiResult` — it has no idea two model calls happened.
 *
 * Referential integrity between the two calls' output is enforced here
 * in code, not trusted from either model: `painPointIds` on each
 * stakeholder is *computed* from the Pain Analyst's
 * `stakeholderLocalId` references, and every cross-reference
 * (pain → stakeholder, primaryPain/secondaryPains → pain) is verified
 * to actually resolve before the merged result is accepted.
 */
export async function runStakeholderPainPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<StakeholderPainAnalysis>> {
  const stakeholderResult = await runStakeholderAnalyst(context, provider);
  if (stakeholderResult.status !== "ok") {
    return stakeholderResult;
  }

  const painResult = await runPainAnalyst(
    context,
    stakeholderResult.data.stakeholders,
    provider,
  );
  if (painResult.status !== "ok") {
    return painResult;
  }

  const knownStakeholderIds = new Set(
    stakeholderResult.data.stakeholders.map((s) => s.localId),
  );
  const unknownStakeholderRef = painResult.data.painPoints.find(
    (p) => !knownStakeholderIds.has(p.stakeholderLocalId),
  );
  if (unknownStakeholderRef) {
    return {
      status: "invalid_output",
      message: `Pain point "${unknownStakeholderRef.localId}" references unknown stakeholder "${unknownStakeholderRef.stakeholderLocalId}".`,
      raw: JSON.stringify(painResult.data),
    };
  }

  const knownPainIds = new Set(painResult.data.painPoints.map((p) => p.localId));
  const allPainRefs = [
    painResult.data.primaryPain,
    ...painResult.data.secondaryPains,
  ];
  const unknownPainRef = allPainRefs.find((ref) => !knownPainIds.has(ref.painLocalId));
  if (unknownPainRef) {
    return {
      status: "invalid_output",
      message: `primaryPain/secondaryPains references unknown pain point "${unknownPainRef.painLocalId}".`,
      raw: JSON.stringify(painResult.data),
    };
  }

  const stakeholders: Stakeholder[] = stakeholderResult.data.stakeholders.map(
    (stakeholder) => ({
      ...stakeholder,
      painPointIds: painResult.data.painPoints
        .filter((p) => p.stakeholderLocalId === stakeholder.localId)
        .map((p) => p.localId),
    }),
  );

  const merged = {
    stakeholders,
    painPoints: painResult.data.painPoints,
    primaryPain: painResult.data.primaryPain,
    secondaryPains: painResult.data.secondaryPains,
    downstreamConsequences: painResult.data.downstreamConsequences,
    customerDistinction: painResult.data.customerDistinction,
    validationQuestions: painResult.data.validationQuestions,
    realityCheck: painResult.data.realityCheck,
    consultantMessage: painResult.data.consultantMessage,
  };

  const validated = stakeholderPainAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return {
      status: "invalid_output",
      message: `Merged Phase 02 output failed schema validation: ${validated.error.message}`,
      raw: JSON.stringify(merged),
    };
  }

  return {
    status: "ok",
    data: validated.data,
    model: painResult.model,
    usage: combineUsage(stakeholderResult.usage, painResult.usage),
  };
}
