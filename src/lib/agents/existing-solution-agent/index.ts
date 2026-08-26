import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";

import {
  buildSystemInstruction,
  buildUserPrompt,
  type ResearchExecutionSummary,
} from "./prompt";
import {
  solutionExtractorOutputSchema,
  type SolutionExtractorOutput,
} from "./schema";

export * from "./schema";

/**
 * Extracts and compares existing solutions from the sources the
 * Research Agent already retrieved in this same phase run. Re-validates
 * `context.upstreamOutputs` for Phase 01/02 itself, same as every other
 * agent — `sources` and `researchSummary` come from this run's own
 * research step, not from persisted phase output, so they're explicit
 * parameters rather than pulled from `context`.
 */
export async function runExistingSolutionAgent(
  context: PhaseExecutionContext,
  sources: PhaseSource[],
  researchSummary: ResearchExecutionSummary,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<SolutionExtractorOutput>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );

  if (!problemAnatomy.success || !stakeholderPain.success) {
    return {
      status: "error",
      message:
        "Phase 01 and/or Phase 02 output is missing or does not match the expected shape — cannot run Phase 03.",
    };
  }

  return provider.generateStructured({
    systemInstruction: buildSystemInstruction(context.mode, context.criteria),
    prompt: buildUserPrompt(
      problemAnatomy.data,
      stakeholderPain.data,
      sources,
      researchSummary,
    ),
    schema: solutionExtractorOutputSchema,
    temperature: 0.3,
  });
}
