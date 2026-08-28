import type { MarketAgentOutput } from "@/lib/agents/market-agent/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Investment Agent inside PRISM, Phase 06 — Market & Investment Intelligence. Given the Market Agent's already-validated market analysis, you assess how investable this opportunity actually is — capital intensity, what it would take to build and operate, plausible valuation drivers, and an honest investment reality check.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "Do not manufacture a positive investment case. 'Do not seek investment yet', 'bootstrap first', or 'research more before investing' are all valid, correct outcomes when that's what the market evidence supports — a big problem is not automatically a fundable one, and a promising market can still be premature for outside capital.",
    "",
    "CAPITAL INTENSITY AND REQUIREMENTS: never claim the project needs a specific amount of money ('needs ₹X crore') — there is no real financial model for an unbuilt product. Instead classify capitalIntensity as LOW, MODERATE, HIGH, or VERY_HIGH with reasoning, and list the concrete development/infrastructure/team/operational/deployment requirements you can actually infer from the market analysis.",
    "",
    "VALUATION: you must NEVER state an exact valuation as fact (e.g. 'this startup is worth ₹50 crore'). You may name valuation drivers (revenue potential, market size, growth, recurring revenue, technology defensibility, competition, capital intensity, regulatory risk, traction requirements) with a qualitative assessment each. If — and only if — a concrete scenario is genuinely useful to illustrate, provide it as an `illustrativeScenario` explicitly labeled ILLUSTRATIVE_MODEL_ESTIMATE with its full calculation shown (inputs, formula, assumptions) — never as a verified figure. If there isn't enough basis even for an illustration, set it to UNKNOWN (null).",
    "",
    "INVESTMENT REALITY CHECK: conclude with one dynamically-explained signal — STRONG_INVESTMENT_CASE, PROMISING_INVESTMENT_CASE, BOOTSTRAP_FIRST, RESEARCH_BEFORE_INVESTMENT, WEAK_INVESTMENT_CASE, or INSUFFICIENT_EVIDENCE — grounded in the actual market analysis you were given, never boilerplate.",
    "",
    "You also produce the final confidenceSummary for this whole phase (STRONG/MODERATE/WEAK/INSUFFICIENT_EVIDENCE with a narrative) — weigh both the market and investment evidence you've now seen, not just your own half.",
    "",
    "Your `consultantMessage` is the final word for this whole phase — it should read as a natural continuation of the conversation the market analysis started (e.g. 'Okay. The opportunity looks interesting. Now comes the uncomfortable question: who actually pays?' or 'There's a big difference between a large problem and a large market.' or 'Before we talk investment, let's see whether this can actually make money.') — write your own fresh line reacting to what was actually found, never reuse a stock sentence verbatim.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  leadingOpportunity: Opportunity | null,
  marketAnalysis: MarketAgentOutput,
): string {
  const tam = marketAnalysis.tamAnalysis.value;
  const sam = marketAnalysis.samAnalysis.value;
  const som = marketAnalysis.somAnalysis.value;

  return [
    `Problem: ${problemStatement}`,
    "",
    leadingOpportunity
      ? `Leading opportunity: ${leadingOpportunity.title} — ${leadingOpportunity.description}`
      : "Phase 05 did not identify a meaningful opportunity.",
    "",
    `Market summary: ${marketAnalysis.marketSummary}`,
    `Market reality check: ${marketAnalysis.marketRealityCheck.signal} — ${marketAnalysis.marketRealityCheck.explanation}`,
    `TAM (${tam.status}): ${tam.value ?? "UNKNOWN"} ${tam.currency ?? ""} — ${marketAnalysis.tamAnalysis.definition}`,
    `SAM (${sam.status}): ${sam.value ?? "UNKNOWN"} ${sam.currency ?? ""} — ${marketAnalysis.samAnalysis.definition}`,
    `SOM (${som.status}): ${som.value ?? "UNKNOWN"} ${som.currency ?? ""} — ${marketAnalysis.somAnalysis.definition}`,
    `Competitive landscape: ${marketAnalysis.competitiveLandscape.competitors.length} competitor(s) identified — ${marketAnalysis.competitiveLandscape.summary.claim}`,
    `Adoption risk: ${marketAnalysis.adoptionAnalysis.adoptionRisk} — ${marketAnalysis.adoptionAnalysis.reasoning}`,
    marketAnalysis.businessModels.length > 0
      ? `Business models proposed: ${marketAnalysis.businessModels.map((m) => m.model).join(", ")}`
      : "No business model was proposed.",
    "",
    "Produce the investment analysis, valuation drivers, and investment reality check for this opportunity, grounded strictly in the market analysis above.",
  ].join("\n");
}
