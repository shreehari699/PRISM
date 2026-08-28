import "server-only";

import { runInvestmentAgent } from "@/lib/agents/investment-agent";
import { runMarketAgent } from "@/lib/agents/market-agent";
import type { MarketEvidenceSourceInput } from "@/lib/agents/market-agent/prompt";
import { runMarketResearchAgent } from "@/lib/agents/market-research-agent";
import { combineUsage, getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import {
  opportunityInnovationAnalysisSchema,
  type Opportunity,
  type OpportunityInnovationAnalysis,
} from "@/lib/phases/opportunity-innovation/schema";
import { collectCitedSourceIds } from "@/lib/prism/evidence";
import { getResearchProvider, type ResearchProvider } from "@/lib/research";

import {
  marketInvestmentAnalysisSchema,
  type MarketEvidenceSource,
  type MarketInvestmentAnalysis,
} from "./schema";

export * from "./schema";

/** Anti-overclaim guard on `marketPositionIfVerified`: "market leader"/"dominant" language requires VERIFIED evidence. */
const MARKET_LEADERSHIP_PATTERN = /\b(market leader|leading|dominant|largest|number one|#1)\b/i;

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/**
 * The leading opportunity is Phase 05's own top-ranked opportunity
 * (from `opportunityLandscape`, computed there — never re-derived here)
 * whose refined state isn't `INSUFFICIENT_EVIDENCE`. `null` when Phase 05
 * concluded `NO_MEANINGFUL_OPPORTUNITY`, found nothing at all, or every
 * ranked opportunity is itself insufficient-evidence. Exported so Phase 07
 * (and any later phase) can identify the same "the opportunity" Phase 06
 * assessed, without re-deriving the selection logic a second time.
 */
export function selectLeadingOpportunity(analysis: OpportunityInnovationAnalysis): Opportunity | null {
  if (analysis.overallFinding === "NO_MEANINGFUL_OPPORTUNITY" || analysis.opportunities.length === 0) {
    return null;
  }

  const byId = new Map(analysis.opportunities.map((o) => [o.opportunityId, o]));
  const ranked = [...analysis.opportunityLandscape].sort((a, b) => a.rank - b.rank);

  for (const entry of ranked) {
    const opportunity = byId.get(entry.opportunityId);
    if (opportunity && opportunity.opportunityState !== "INSUFFICIENT_EVIDENCE") {
      return opportunity;
    }
  }

  return null;
}

/**
 * Phase 06 — Market & Investment Intelligence. Runs the Market Research
 * Agent (bounded Tavily research, reusing Phase 03's sources rather than
 * re-researching known ground), then the Market Agent, then the
 * Investment Agent grounded in the Market Agent's own validated output,
 * then merges all three into one validated result — the same
 * three-call-into-one-AiResult pattern Phase 03 established for its own
 * research-agent + existing-solution-agent pipeline.
 */
export async function runMarketInvestmentPhase(
  context: PhaseExecutionContext,
  aiProvider: AiProvider = getAiProvider(),
  researchProvider: ResearchProvider = getResearchProvider(),
): Promise<AiResult<MarketInvestmentAnalysis>> {
  const opportunityInnovation = opportunityInnovationAnalysisSchema.safeParse(
    context.upstreamOutputs.opportunity_innovation,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  if (!opportunityInnovation.success || !existingSolutions.success) {
    return {
      status: "error",
      message:
        "Phase 03 and/or Phase 05 output is missing or does not match the expected shape — cannot run Phase 06.",
    };
  }

  const leadingOpportunity = selectLeadingOpportunity(opportunityInnovation.data);

  const researchResult = await runMarketResearchAgent(
    context,
    leadingOpportunity,
    aiProvider,
    researchProvider,
  );
  if (researchResult.status !== "ok") {
    return researchResult;
  }

  const combinedSources: MarketEvidenceSource[] = [
    ...existingSolutions.data.sources.map((s) => ({
      sourceLocalId: s.sourceLocalId,
      title: s.title,
      url: s.url,
      sourceType: s.sourceType,
      retrievedAt: s.retrievedAt,
      snippet: s.snippet,
      origin: "existing_solutions_reused" as const,
    })),
    ...(researchResult.budgetExhausted ? [] : researchResult.sources).map((s) => ({
      sourceLocalId: s.sourceLocalId,
      title: s.title,
      url: s.url,
      sourceType: s.sourceType,
      retrievedAt: s.retrievedAt,
      snippet: s.snippet,
      origin: "market_research" as const,
    })),
  ];
  const sourcesForPrompt: MarketEvidenceSourceInput[] = combinedSources.map(
    ({ sourceLocalId, title, url, snippet, origin }) => ({ sourceLocalId, title, url, snippet, origin }),
  );
  const knownSourceIds = new Set(combinedSources.map((s) => s.sourceLocalId));

  const researchSummary = {
    queriesExecuted: researchResult.budgetExhausted ? 0 : researchResult.queriesExecuted,
    researchFailures: researchResult.budgetExhausted ? 0 : researchResult.researchFailures,
    budgetExhausted: researchResult.budgetExhausted,
  };

  const marketResult = await runMarketAgent(
    context,
    leadingOpportunity,
    sourcesForPrompt,
    researchSummary,
    aiProvider,
  );
  if (marketResult.status !== "ok") {
    return marketResult;
  }

  const marketCitedIds = new Set<string>();
  collectCitedSourceIds(marketResult.data, marketCitedIds);
  const badMarketSource = [...marketCitedIds].find((id) => !knownSourceIds.has(id));
  if (badMarketSource) {
    return invalidOutput(
      `Market analysis cites unknown source "${badMarketSource}".`,
      marketResult.data,
    );
  }

  for (const competitor of marketResult.data.competitiveLandscape.competitors) {
    if (
      competitor.marketPositionIfVerified.status !== "VERIFIED" &&
      MARKET_LEADERSHIP_PATTERN.test(competitor.marketPositionIfVerified.claim)
    ) {
      return invalidOutput(
        `Competitor "${competitor.name}" is described with market-leadership language without VERIFIED evidence.`,
        marketResult.data,
      );
    }
  }

  const tam = marketResult.data.tamAnalysis.value;
  const sam = marketResult.data.samAnalysis.value;
  const som = marketResult.data.somAnalysis.value;
  if (tam.value !== null && sam.value !== null && sam.value > tam.value) {
    return invalidOutput(
      `SAM (${sam.value}) cannot exceed TAM (${tam.value}) — the serviceable market can never be larger than the total addressable market.`,
      marketResult.data,
    );
  }
  if (sam.value !== null && som.value !== null && som.value > sam.value) {
    return invalidOutput(
      `SOM (${som.value}) cannot exceed SAM (${sam.value}) — the obtainable market can never be larger than the serviceable market.`,
      marketResult.data,
    );
  }

  const investmentResult = await runInvestmentAgent(
    context,
    leadingOpportunity,
    marketResult.data,
    sourcesForPrompt,
    aiProvider,
  );
  if (investmentResult.status !== "ok") {
    return investmentResult;
  }

  const investmentCitedIds = new Set<string>();
  collectCitedSourceIds(investmentResult.data, investmentCitedIds);
  const badInvestmentSource = [...investmentCitedIds].find((id) => !knownSourceIds.has(id));
  if (badInvestmentSource) {
    return invalidOutput(
      `Investment analysis cites unknown source "${badInvestmentSource}".`,
      investmentResult.data,
    );
  }

  const marketNumbers = [
    marketResult.data.tamAnalysis.value,
    marketResult.data.samAnalysis.value,
    marketResult.data.somAnalysis.value,
    ...marketResult.data.businessModels.map((m) => m.pricingHypothesis),
    marketResult.data.unitEconomics.customerAcquisitionCost,
    marketResult.data.unitEconomics.revenuePerCustomer,
    marketResult.data.unitEconomics.grossMargin,
    marketResult.data.unitEconomics.operationalCost,
    marketResult.data.unitEconomics.supportCost,
    marketResult.data.unitEconomics.infrastructureCost,
    marketResult.data.unitEconomics.paybackPeriod,
  ];
  const verifiedNumbersCount = marketNumbers.filter((n) => n.status === "VERIFIED").length;
  const modelEstimateNumbersCount = marketNumbers.filter((n) => n.status === "MODEL_ESTIMATE").length;
  const unknownNumbersCount = marketNumbers.filter((n) => n.status === "UNKNOWN").length;

  const allCitedIds = new Set<string>([...marketCitedIds, ...investmentCitedIds]);

  const evidenceStatus =
    researchResult.budgetExhausted || researchSummary.researchFailures > 0
      ? "PARTIAL_MARKET_EVIDENCE"
      : "COMPLETE";
  const reusedCount = existingSolutions.data.sources.length;
  const newCount = combinedSources.length - reusedCount;

  const validationQuestions = [
    ...new Set([...marketResult.data.validationQuestions, ...investmentResult.data.validationQuestions]),
  ];

  const merged = {
    marketSummary: marketResult.data.marketSummary,
    customerModel: marketResult.data.customerModel,
    marketSegments: marketResult.data.marketSegments,
    competitiveLandscape: marketResult.data.competitiveLandscape,
    marketDrivers: marketResult.data.marketDrivers,
    adoptionAnalysis: marketResult.data.adoptionAnalysis,
    marketEvidence: {
      sources: combinedSources,
      status: evidenceStatus,
      narrative: `${combinedSources.length} evidence source(s) available (${reusedCount} reused from Phase 03, ${newCount} newly researched this run).`,
    },
    tamAnalysis: marketResult.data.tamAnalysis,
    samAnalysis: marketResult.data.samAnalysis,
    somAnalysis: marketResult.data.somAnalysis,
    businessModels: marketResult.data.businessModels,
    pricingHypotheses: marketResult.data.businessModels.map((m) => ({
      model: m.model,
      pricingHypothesis: m.pricingHypothesis,
    })),
    unitEconomics: marketResult.data.unitEconomics,
    scalability: marketResult.data.scalability,
    investmentAnalysis: investmentResult.data.investmentAnalysis,
    valuationDrivers: investmentResult.data.valuationDrivers,
    marketRealityCheck: marketResult.data.marketRealityCheck,
    investmentRealityCheck: investmentResult.data.investmentRealityCheck,
    marketScores: marketResult.data.marketScores,
    investmentScores: investmentResult.data.investmentScores,
    evidenceSummary: {
      totalSourcesReferenced: allCitedIds.size,
      verifiedNumbersCount,
      modelEstimateNumbersCount,
      unknownNumbersCount,
      narrative: `${verifiedNumbersCount} verified figure(s), ${modelEstimateNumbersCount} modeled estimate(s), ${unknownNumbersCount} unknown, across ${allCitedIds.size} cited source(s).`,
    },
    confidenceSummary: investmentResult.data.confidenceSummary,
    validationQuestions,
    consultantMessage: investmentResult.data.consultantMessage,
  };

  const validated = marketInvestmentAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 06 output failed schema validation: ${validated.error.message}`,
      merged,
    );
  }

  return {
    status: "ok",
    data: validated.data,
    model: investmentResult.model,
    usage: combineUsage(
      researchResult.budgetExhausted ? undefined : researchResult.usage,
      marketResult.usage,
      investmentResult.usage,
    ),
  };
}
