import "server-only";

import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import {
  buildSystemInstruction,
  buildUserPrompt,
  type MarketEvidenceSourceInput,
  type MarketResearchSummary,
} from "./prompt";
import { marketAgentOutputSchema, type MarketAgentOutput } from "./schema";

export * from "./schema";

/**
 * `leadingOpportunity` and `sources` are composer-selected/assembled
 * values (the Phase 05 leading opportunity, and the merged Phase
 * 03-reused + Phase 06-researched evidence list) rather than raw
 * upstream phase output, so both are explicit parameters — the same
 * pattern the Pain Analyst uses for the Stakeholder Analyst's output.
 * `stakeholder_pain` and `existing_solutions` ARE raw upstream phase
 * output, so those are re-parsed from `context.upstreamOutputs` as
 * defense-in-depth, like every prior phase's agents do.
 */
export async function runMarketAgent(
  context: PhaseExecutionContext,
  leadingOpportunity: Opportunity | null,
  sources: MarketEvidenceSourceInput[],
  researchSummary: MarketResearchSummary,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<MarketAgentOutput>> {
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );

  if (!stakeholderPain.success || !existingSolutions.success) {
    return {
      status: "error",
      message:
        "Phase 02 and/or Phase 03 output is missing or does not match the expected shape — cannot run Phase 06.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      context.problemStatement,
      leadingOpportunity,
      stakeholderPain.data,
      existingSolutions.data,
      sources,
      researchSummary,
    ),
    schema: marketAgentOutputSchema,
    temperature: 0.35,
  });
}
