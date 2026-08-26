import "server-only";

import { runInnovationAgent } from "@/lib/agents/innovation-agent";
import type {
  InnovationAssessment,
  OpportunityLandscapeEntry,
} from "@/lib/agents/innovation-agent/schema";
import { runOpportunityAgent } from "@/lib/agents/opportunity-agent";
import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import { combineUsage, getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import type { RichEvidenceClaim } from "@/lib/prism/evidence";
import type { QualitativeLevel } from "@/lib/prism/scoring";

import {
  opportunityInnovationAnalysisSchema,
  type Opportunity,
  type OpportunityInnovationAnalysis,
} from "./schema";

export * from "./schema";

const OVERCLAIM_PATTERN = /\b(first|only|unique|world'?s first)\b/i;

const QUALITATIVE_WEIGHT: Record<QualitativeLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function findUnknownId(ids: string[], known: Set<string>): string | undefined {
  return ids.find((id) => !known.has(id));
}

function claimsOf(opportunity: DraftOpportunity): RichEvidenceClaim[] {
  return [opportunity.unservedNeed, opportunity.existingSolutionContext, ...opportunity.evidenceClaims];
}

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/**
 * Phase 05 — Opportunity & Innovation Intelligence. Runs the Opportunity
 * Agent, validates its references against Phases 01-04, runs the
 * Innovation Agent against the resulting draft opportunities, then
 * merges the two into one validated result. Every cross-reference the
 * opportunity chain requires (stakeholder → pain → gap → opportunity →
 * innovation direction) is checked here in code, never trusted from
 * either model.
 */
export async function runOpportunityInnovationPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<OpportunityInnovationAnalysis>> {
  const opportunityResult = await runOpportunityAgent(context, provider);
  if (opportunityResult.status !== "ok") {
    return opportunityResult;
  }

  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  const gapIntelligence = gapIntelligenceAnalysisSchema.safeParse(
    context.upstreamOutputs.gap_intelligence,
  );
  if (!stakeholderPain.success || !existingSolutions.success || !gapIntelligence.success) {
    return {
      status: "error",
      message: "Phase 02/03/04 output could not be re-validated while merging Phase 05 output.",
    };
  }

  const knownStakeholderIds = new Set(
    stakeholderPain.data.stakeholders.map((s) => s.localId),
  );
  const knownPainIds = new Set(stakeholderPain.data.painPoints.map((p) => p.localId));
  const knownSourceIds = new Set(existingSolutions.data.sources.map((s) => s.sourceLocalId));
  const gapById = new Map(gapIntelligence.data.gapCandidates.map((g) => [g.gapId, g]));

  const draftOpportunities = opportunityResult.data.opportunities;

  for (const opportunity of draftOpportunities) {
    const badStakeholder = findUnknownId(opportunity.affectedStakeholders, knownStakeholderIds);
    if (badStakeholder) {
      return invalidOutput(
        `Opportunity "${opportunity.opportunityId}" references unknown stakeholder "${badStakeholder}".`,
        opportunityResult.data,
      );
    }

    const badPain = findUnknownId(opportunity.relatedPains, knownPainIds);
    if (badPain) {
      return invalidOutput(
        `Opportunity "${opportunity.opportunityId}" references unknown pain "${badPain}".`,
        opportunityResult.data,
      );
    }

    for (const gapId of opportunity.relatedGaps) {
      const gap = gapById.get(gapId);
      if (!gap) {
        return invalidOutput(
          `Opportunity "${opportunity.opportunityId}" references unknown gap "${gapId}".`,
          opportunityResult.data,
        );
      }
      if (gap.gapState === "NO_GAP_ESTABLISHED") {
        return invalidOutput(
          `Opportunity "${opportunity.opportunityId}" is grounded in gap "${gapId}", but that gap is NO_GAP_ESTABLISHED — an existing solution already covers it.`,
          opportunityResult.data,
        );
      }
    }

    for (const claim of claimsOf(opportunity)) {
      const badSource = findUnknownId(claim.sourceIds, knownSourceIds);
      if (badSource) {
        return invalidOutput(
          `Opportunity "${opportunity.opportunityId}" has a claim citing unknown source "${badSource}".`,
          opportunityResult.data,
        );
      }
    }
  }

  const innovationResult = await runInnovationAgent(context, draftOpportunities, provider);
  if (innovationResult.status !== "ok") {
    return innovationResult;
  }

  const knownOpportunityIds = new Set(draftOpportunities.map((o) => o.opportunityId));

  const badAssessmentRef = innovationResult.data.assessments.find(
    (a) => !knownOpportunityIds.has(a.opportunityId),
  );
  if (badAssessmentRef) {
    return invalidOutput(
      `Innovation assessment references unknown opportunity "${badAssessmentRef.opportunityId}".`,
      innovationResult.data,
    );
  }

  const assessmentByOpportunityId = new Map<string, InnovationAssessment>();
  for (const assessment of innovationResult.data.assessments) {
    if (assessmentByOpportunityId.has(assessment.opportunityId)) {
      return invalidOutput(
        `Opportunity "${assessment.opportunityId}" has more than one innovation assessment.`,
        innovationResult.data,
      );
    }
    assessmentByOpportunityId.set(assessment.opportunityId, assessment);
  }
  const missingAssessment = draftOpportunities.find(
    (o) => !assessmentByOpportunityId.has(o.opportunityId),
  );
  if (missingAssessment) {
    return invalidOutput(
      `Opportunity "${missingAssessment.opportunityId}" has no innovation assessment.`,
      innovationResult.data,
    );
  }

  for (const assessment of innovationResult.data.assessments) {
    if (assessment.differentiation.status !== "VERIFIED" && OVERCLAIM_PATTERN.test(assessment.differentiation.claim)) {
      return invalidOutput(
        `Opportunity "${assessment.opportunityId}" claims a superlative differentiation ("first"/"only"/"unique"/"world's first") without VERIFIED evidence — must be phrased as a potential or identified differentiation instead.`,
        innovationResult.data,
      );
    }
    const badSource = findUnknownId(assessment.differentiation.sourceIds, knownSourceIds);
    if (badSource) {
      return invalidOutput(
        `Opportunity "${assessment.opportunityId}" differentiation cites unknown source "${badSource}".`,
        innovationResult.data,
      );
    }

    for (const direction of assessment.innovationDirections) {
      if (
        direction.directionType === "AI_ML" &&
        direction.aiJustification.classification === "AI_NOT_JUSTIFIED"
      ) {
        return invalidOutput(
          `Opportunity "${assessment.opportunityId}" proposes an AI_ML direction whose own justification says AI is not justified — contradiction.`,
          innovationResult.data,
        );
      }
    }
  }

  const knownLandscapeOpportunityIds = new Set(
    innovationResult.data.opportunityLandscape.map((e) => e.opportunityId),
  );
  const missingFromLandscape = draftOpportunities.find(
    (o) => !knownLandscapeOpportunityIds.has(o.opportunityId),
  );
  if (missingFromLandscape) {
    return invalidOutput(
      `Opportunity "${missingFromLandscape.opportunityId}" is missing from the opportunity landscape — weaker opportunities must not be hidden.`,
      innovationResult.data,
    );
  }
  const badLandscapeRef = innovationResult.data.opportunityLandscape.find(
    (e) => !knownOpportunityIds.has(e.opportunityId),
  );
  if (badLandscapeRef) {
    return invalidOutput(
      `Opportunity landscape entry references unknown opportunity "${badLandscapeRef.opportunityId}".`,
      innovationResult.data,
    );
  }

  const opportunities: Opportunity[] = draftOpportunities.map((draft) => {
    const assessment = assessmentByOpportunityId.get(draft.opportunityId)!;
    return {
      ...draft,
      innovationDirections: assessment.innovationDirections,
      differentiation: assessment.differentiation,
      innovationPotential: assessment.innovationPotential,
      feasibilityPotential: assessment.feasibilityPotential,
      opportunityState: assessment.refinedOpportunityState,
      validationQuestions: assessment.validationQuestions,
    };
  });

  const rankedLandscape = rankLandscape(innovationResult.data.opportunityLandscape);

  const overallFinding =
    opportunities.length === 0 ||
    opportunities.every((o) => o.opportunityState === "INSUFFICIENT_EVIDENCE")
      ? "NO_MEANINGFUL_OPPORTUNITY"
      : "MEANINGFUL_OPPORTUNITY_FOUND";

  const merged = {
    opportunities,
    opportunityLandscape: rankedLandscape,
    opportunityRealityCheck: innovationResult.data.opportunityRealityCheck,
    overallFinding,
    consultantMessage: innovationResult.data.consultantMessage,
  };

  const validated = opportunityInnovationAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 05 output failed schema validation: ${validated.error.message}`,
      merged,
    );
  }

  return {
    status: "ok",
    data: validated.data,
    model: innovationResult.model,
    usage: combineUsage(opportunityResult.usage, innovationResult.usage),
  };
}

/**
 * Ranks landscape entries by a composite of their qualitative levels,
 * computed here in code — the model supplies honest per-dimension
 * judgments, never a fabricated rank or bare number.
 */
function rankLandscape(
  entries: OpportunityLandscapeEntry[],
): (OpportunityLandscapeEntry & { rank: number })[] {
  const withComposite = entries.map((entry) => ({
    entry,
    composite:
      QUALITATIVE_WEIGHT[entry.stakeholderValue] +
      QUALITATIVE_WEIGHT[entry.painRelevance] +
      QUALITATIVE_WEIGHT[entry.gapStrength] +
      QUALITATIVE_WEIGHT[entry.differentiationStrength] +
      QUALITATIVE_WEIGHT[entry.innovationStrength] +
      QUALITATIVE_WEIGHT[entry.feasibilityStrength] +
      QUALITATIVE_WEIGHT[entry.impactStrength] +
      QUALITATIVE_WEIGHT[entry.confidence],
  }));

  withComposite.sort((a, b) => b.composite - a.composite);

  return withComposite.map(({ entry }, index) => ({ ...entry, rank: index + 1 }));
}
