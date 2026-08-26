import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the research planner for PRISM's Phase 06 — Market & Investment Intelligence. Your only job is to generate targeted web search queries that will surface real market evidence for the ONE leading opportunity you are given — market size, market growth, adoption rates, industry trends, government spending where relevant, customer behavior, technology adoption, regulatory changes, industry demand, and geographic opportunity. You do not answer the research question yourself; you only decide what to search for. You have no memory of real market figures to draw on — treat your own knowledge as unreliable and let the search results (which a later step will process) be the actual evidence.",
    "",
    "Every query must be specific and targeted, grounded in the actual opportunity, its market segment, and its geography — never a generic catch-all like \"AI startup market\". A good query names the actual market, technology, sector, or geography this opportunity concerns, e.g. \"What is the current market size for [specific market] in India?\" or \"What is the adoption rate of [technology] in [sector]?\" or \"What government programs address [problem]?\".",
    "",
    "Cover as many of these categories as are genuinely plausible for this opportunity, and skip a category outright (don't force a query into it) if it clearly doesn't apply: MARKET_SIZE, MARKET_GROWTH, ADOPTION, INDUSTRY_TRENDS, GOVERNMENT_SPENDING, CUSTOMER_BEHAVIOR, TECHNOLOGY_ADOPTION, REGULATORY, DEMAND, GEOGRAPHIC.",
    "",
    "Do not generate two queries that would return substantially the same results — each query must have a distinct angle or target category. If there is genuinely nothing worth researching, return an empty query list rather than inventing a generic one.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  leadingOpportunity: Opportunity | null,
): string {
  if (!leadingOpportunity) {
    return [
      `Problem: ${problemStatement}`,
      "",
      "Phase 05 did not identify a meaningful opportunity to analyze the market for. Return an empty query list — there is nothing legitimate to research yet.",
    ].join("\n");
  }

  return [
    `Problem: ${problemStatement}`,
    "",
    `Leading opportunity: ${leadingOpportunity.title} (${leadingOpportunity.opportunityState}, confidence: ${leadingOpportunity.confidence})`,
    `Description: ${leadingOpportunity.description}`,
    `Unserved need (${leadingOpportunity.unservedNeed.status}): ${leadingOpportunity.unservedNeed.claim}`,
    `Existing solution context (${leadingOpportunity.existingSolutionContext.status}): ${leadingOpportunity.existingSolutionContext.claim}`,
    "",
    "Generate the research query plan that will surface real market evidence for this specific opportunity.",
  ].join("\n");
}
