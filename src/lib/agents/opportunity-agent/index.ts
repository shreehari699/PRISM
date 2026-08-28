import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { buildDynamicOpportunityAgentOutputSchema, type OpportunityAgentOutput } from "./schema";

export * from "./schema";

/**
 * Requires all four of `problem_intelligence`, `stakeholder_pain`,
 * `existing_solutions`, and `gap_intelligence` from
 * `context.upstreamOutputs`. The phase engine's orchestrator gating
 * already guarantees the approval-gated ones among these are approved
 * before Phase 05 can run — this re-parse is the same defense-in-depth
 * every prior phase applies to its own upstream input.
 */
export async function runOpportunityAgent(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<OpportunityAgentOutput>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  const gapIntelligence = gapIntelligenceAnalysisSchema.safeParse(
    context.upstreamOutputs.gap_intelligence,
  );

  if (
    !problemAnatomy.success ||
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success
  ) {
    return {
      status: "error",
      message:
        "Phase 01, 02, 03, and/or 04 output is missing or does not match the expected shape — cannot run Phase 05.",
    };
  }

  const dynamicSchema = buildDynamicOpportunityAgentOutputSchema({
    stakeholderIds: stakeholderPain.data.stakeholders.map((s) => s.localId),
    painIds: stakeholderPain.data.painPoints.map((p) => p.localId),
    gapIds: gapIntelligence.data.gapCandidates.map((g) => g.gapId),
    sourceIds: existingSolutions.data.sources.map((s) => s.sourceLocalId),
  });

  const result = await provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      problemAnatomy.data,
      stakeholderPain.data,
      existingSolutions.data,
      gapIntelligence.data,
    ),
    schema: dynamicSchema,
    temperature: 0.35,
  });

  // The dynamic schema is a strict narrowing of `OpportunityAgentOutput`
  // (every id field is a subset of `string`), so a value that satisfies
  // it always satisfies the static type too — this just restores that
  // plain, non-call-specific type for downstream code.
  return result as AiResult<OpportunityAgentOutput>;
}
