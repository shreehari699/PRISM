import "server-only";

import { runGapAgent } from "@/lib/agents/gap-agent";
import type { GapCandidate, GapEvidenceClaim } from "@/lib/agents/gap-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import {
  gapIntelligenceAnalysisSchema,
  type GapIntelligenceAnalysis,
} from "./schema";

export * from "./schema";

function findUnknownId(ids: string[], known: Set<string>): string | undefined {
  return ids.find((id) => !known.has(id));
}

function claimsOf(gap: GapCandidate): GapEvidenceClaim[] {
  return [gap.missingCapability, gap.whyItMatters, ...gap.evidenceClaims];
}

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/**
 * Phase 04 — Gap Intelligence. Runs the single Gap Agent call, then
 * enforces everything Zod alone can't check:
 *
 * - Every stakeholder/pain/solution/source id the agent cited must
 *   resolve to something Phases 01-03 actually produced — an
 *   unresolvable reference is rejected as `invalid_output`, the same
 *   discipline Phase 02/03 apply to their own cross-references.
 * - False-gap prevention: a `CONFIRMED_GAP` whose core claim is only an
 *   `ASSUMPTION`, or which cites zero sources, is rejected outright —
 *   "evidence strongly indicates" cannot rest on an assumption alone.
 * - `confirmedGaps`/`candidateGaps`/`unverifiedGaps`/`noGapFindings` are
 *   *derived* here by filtering `gapCandidates` on `gapState`, and
 *   `evidenceSummary`'s counts are computed from the actual claims and
 *   source citations — never asked of or estimated by the model.
 */
export async function runGapIntelligencePhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<GapIntelligenceAnalysis>> {
  const gapResult = await runGapAgent(context, provider);
  if (gapResult.status !== "ok") {
    return gapResult;
  }

  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  if (!stakeholderPain.success || !existingSolutions.success) {
    return {
      status: "error",
      message: "Phase 02/03 output could not be re-validated while merging Phase 04 output.",
    };
  }

  const knownStakeholderIds = new Set(
    stakeholderPain.data.stakeholders.map((s) => s.localId),
  );
  const knownPainIds = new Set(stakeholderPain.data.painPoints.map((p) => p.localId));
  const knownSolutionIds = new Set(existingSolutions.data.solutions.map((s) => s.localId));
  const knownSourceIds = new Set(existingSolutions.data.sources.map((s) => s.sourceLocalId));

  for (const gap of gapResult.data.gapCandidates) {
    const badStakeholder = findUnknownId(gap.affectedStakeholders, knownStakeholderIds);
    if (badStakeholder) {
      return invalidOutput(
        `Gap "${gap.gapId}" references unknown stakeholder "${badStakeholder}".`,
        gapResult.data,
      );
    }

    const badPain = findUnknownId(gap.relatedPains, knownPainIds);
    if (badPain) {
      return invalidOutput(
        `Gap "${gap.gapId}" references unknown pain "${badPain}".`,
        gapResult.data,
      );
    }

    const badSolution = findUnknownId(gap.relatedExistingSolutions, knownSolutionIds);
    if (badSolution) {
      return invalidOutput(
        `Gap "${gap.gapId}" references unknown existing solution "${badSolution}".`,
        gapResult.data,
      );
    }

    const badSource = findUnknownId(gap.sourceIds, knownSourceIds);
    if (badSource) {
      return invalidOutput(
        `Gap "${gap.gapId}" cites unknown source "${badSource}".`,
        gapResult.data,
      );
    }

    for (const claim of claimsOf(gap)) {
      const badClaimSource = findUnknownId(claim.sourceIds, knownSourceIds);
      if (badClaimSource) {
        return invalidOutput(
          `Gap "${gap.gapId}" has a claim citing unknown source "${badClaimSource}".`,
          gapResult.data,
        );
      }
    }

    if (gap.gapState === "CONFIRMED_GAP") {
      if (gap.missingCapability.status === "ASSUMPTION") {
        return invalidOutput(
          `Gap "${gap.gapId}" is marked CONFIRMED_GAP but its core claim is only an ASSUMPTION — confirmed gaps require at least an INFERENCE.`,
          gapResult.data,
        );
      }
      if (gap.sourceIds.length === 0) {
        return invalidOutput(
          `Gap "${gap.gapId}" is marked CONFIRMED_GAP but cites no sources.`,
          gapResult.data,
        );
      }
    }
  }

  for (const entry of gapResult.data.coverageMatrix) {
    if (!knownSolutionIds.has(entry.existingSolutionId)) {
      return invalidOutput(
        `Coverage matrix entry references unknown existing solution "${entry.existingSolutionId}".`,
        gapResult.data,
      );
    }
    if (!knownStakeholderIds.has(entry.stakeholderId)) {
      return invalidOutput(
        `Coverage matrix entry references unknown stakeholder "${entry.stakeholderId}".`,
        gapResult.data,
      );
    }
    if (!knownPainIds.has(entry.painId)) {
      return invalidOutput(
        `Coverage matrix entry references unknown pain "${entry.painId}".`,
        gapResult.data,
      );
    }
    const badSource = findUnknownId(entry.sourceIds, knownSourceIds);
    if (badSource) {
      return invalidOutput(
        `Coverage matrix entry cites unknown source "${badSource}".`,
        gapResult.data,
      );
    }
  }

  const knownGapIds = new Set(gapResult.data.gapCandidates.map((g) => g.gapId));
  const badPriorityRef = gapResult.data.gapPriority.find((p) => !knownGapIds.has(p.gapId));
  if (badPriorityRef) {
    return invalidOutput(
      `Gap priority entry references unknown gap "${badPriorityRef.gapId}".`,
      gapResult.data,
    );
  }

  const confirmedGaps = gapResult.data.gapCandidates
    .filter((g) => g.gapState === "CONFIRMED_GAP")
    .map((g) => g.gapId);
  const candidateGaps = gapResult.data.gapCandidates
    .filter((g) => g.gapState === "CANDIDATE_GAP")
    .map((g) => g.gapId);
  const unverifiedGaps = gapResult.data.gapCandidates
    .filter((g) => g.gapState === "UNVERIFIED_GAP")
    .map((g) => g.gapId);
  const noGapFindings = gapResult.data.gapCandidates
    .filter((g) => g.gapState === "NO_GAP_ESTABLISHED")
    .map((g) => g.gapId);

  let verifiedClaimsCount = 0;
  const referencedSourceIds = new Set<string>();
  for (const gap of gapResult.data.gapCandidates) {
    for (const id of gap.sourceIds) referencedSourceIds.add(id);
    for (const claim of claimsOf(gap)) {
      if (claim.status === "VERIFIED") verifiedClaimsCount += 1;
      for (const id of claim.sourceIds) referencedSourceIds.add(id);
    }
  }
  for (const entry of gapResult.data.coverageMatrix) {
    for (const id of entry.sourceIds) referencedSourceIds.add(id);
  }

  const { evidenceSummary: agentEvidenceSummary, ...restOfGapOutput } = gapResult.data;

  const merged = {
    ...restOfGapOutput,
    confirmedGaps,
    candidateGaps,
    unverifiedGaps,
    noGapFindings,
    evidenceSummary: {
      totalSourcesReferenced: referencedSourceIds.size,
      verifiedClaimsCount,
      narrative: agentEvidenceSummary.narrative,
    },
  };

  const validated = gapIntelligenceAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 04 output failed schema validation: ${validated.error.message}`,
      merged,
    );
  }

  return {
    status: "ok",
    data: validated.data,
    model: gapResult.model,
    usage: gapResult.usage,
  };
}
