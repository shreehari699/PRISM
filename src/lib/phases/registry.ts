import "server-only";

import type { z } from "zod";

import { runProblemAnalyst, problemAnatomySchema } from "@/lib/agents/problem-analyst";
import type { AiProvider, AiResult } from "@/lib/ai/types";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import type { PrismPhaseKey } from "@/lib/prism/phases";
import {
  runExistingSolutionsPhase,
  existingSolutionsAnalysisSchema,
} from "@/lib/phases/existing-solutions";
import {
  runGapIntelligencePhase,
  gapIntelligenceAnalysisSchema,
} from "@/lib/phases/gap-intelligence";
import {
  runMarketInvestmentPhase,
  marketInvestmentAnalysisSchema,
} from "@/lib/phases/market-investment";
import {
  runOpportunityInnovationPhase,
  opportunityInnovationAnalysisSchema,
} from "@/lib/phases/opportunity-innovation";
import {
  runTechnicalFeasibilityPhase,
  technicalFeasibilityAnalysisSchema,
} from "@/lib/phases/technical-feasibility";
import {
  runStakeholderPainPhase,
  stakeholderPainAnalysisSchema,
} from "@/lib/phases/stakeholder-pain";

/**
 * One entry per PRISM phase that has an implemented agent. A phase
 * missing from this registry is not a bug to work around — the phase
 * engine (src/lib/services/phase-engine.ts) treats it as an honest
 * "not implemented yet" (501), never a silently faked result.
 *
 * `execute` may internally call more than one agent and merge their
 * output (e.g. Phase 02 will run both the Stakeholder Analyst and Pain
 * Analyst) — the engine only cares that it gets back one AiResult
 * conforming to `schema`.
 */
export interface PhaseExecutor {
  schema: z.ZodType<unknown>;
  execute: (
    context: PhaseExecutionContext,
    provider?: AiProvider,
  ) => Promise<AiResult<unknown>>;
}

const registry: Partial<Record<PrismPhaseKey, PhaseExecutor>> = {
  problem_intelligence: {
    schema: problemAnatomySchema,
    execute: (context, provider) => runProblemAnalyst(context, provider),
  },
  stakeholder_pain: {
    schema: stakeholderPainAnalysisSchema,
    execute: (context, provider) => runStakeholderPainPhase(context, provider),
  },
  existing_solutions: {
    schema: existingSolutionsAnalysisSchema,
    execute: (context, provider) => runExistingSolutionsPhase(context, provider),
  },
  gap_intelligence: {
    schema: gapIntelligenceAnalysisSchema,
    execute: (context, provider) => runGapIntelligencePhase(context, provider),
  },
  opportunity_innovation: {
    schema: opportunityInnovationAnalysisSchema,
    execute: (context, provider) => runOpportunityInnovationPhase(context, provider),
  },
  market_investment: {
    schema: marketInvestmentAnalysisSchema,
    execute: (context, provider) => runMarketInvestmentPhase(context, provider),
  },
  technical_feasibility: {
    schema: technicalFeasibilityAnalysisSchema,
    execute: (context, provider) => runTechnicalFeasibilityPhase(context, provider),
  },
};

export function getPhaseExecutor(phaseKey: PrismPhaseKey): PhaseExecutor | undefined {
  return registry[phaseKey];
}
