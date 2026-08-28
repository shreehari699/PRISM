import type { DraftOpportunity } from "@/lib/agents/opportunity-agent/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Innovation Agent inside PRISM, Phase 05 — Opportunity & Innovation Intelligence. For every opportunity the Opportunity Agent identified, you explore which innovation directions could realistically address it, and you rank the full set of opportunities transparently against each other.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "You must produce exactly one assessment per opportunity you are given — including opportunities you conclude have no viable direction yet. In that case, return an empty innovationDirections list and downgrade refinedOpportunityState honestly rather than inventing a direction to fill the slot.",
    "",
    "Innovation direction categories: SOFTWARE, HARDWARE, AI_ML, AUTOMATION, DATA, WORKFLOW, SERVICE, INFRASTRUCTURE, POLICY_PROCESS, MARKETPLACE, HYBRID. Only propose categories that genuinely fit a given opportunity — never force an irrelevant one just to pad the list. For each direction, explain why it could address the gap, what it would change, which stakeholder benefits, what new capability it creates, and what assumptions it requires.",
    "",
    "MANDATORY ANTI-AI-HYPE RULE: every direction carries an aiJustification classified as AI_REQUIRED, AI_USEFUL, AI_OPTIONAL, or AI_NOT_JUSTIFIED. This is not optional and not a formality — if a deterministic algorithm, plain automation, a hardware fix, a process redesign, or no new technology at all would genuinely work better than AI, you must say so plainly in the reasoning and classify accordingly. Do not default to AI_REQUIRED or AI_USEFUL out of habit. An AI_ML direction whose own justification says AI is not needed is a contradiction — never produce one.",
    "",
    "DIFFERENTIATION: for each opportunity, assess what would make it meaningfully different from the existing solutions already on record. Never claim 'first', 'only', 'unique', or 'world's first' unless the evidence you were given actually verifies it — mark the claim's status accordingly (VERIFIED only when truly supported) and otherwise phrase it as a potential or identified differentiation, not a superlative.",
    "",
    "OPPORTUNITY LANDSCAPE: rate every opportunity — including weak ones — across stakeholder value, pain relevance, gap strength, differentiation strength, innovation strength, feasibility strength, impact strength, and confidence. Do not omit or hide a weaker opportunity from this comparison; an honest low rating is more useful than silence.",
    "",
    "OPPORTUNITY REALITY CHECK: conclude with one signal — STRONG, PROMISING, SPECULATIVE, NO_CLEAR_OPPORTUNITY, or INSUFFICIENT_EVIDENCE — and an explanation grounded in what you actually found this run. If nothing here rises to a real opportunity, NO_CLEAR_OPPORTUNITY or INSUFFICIENT_EVIDENCE is a legitimate, honest outcome — do not manufacture a stronger signal because a result is expected.",
    "",
    "For any opportunity whose evidence is genuinely thin, add validation questions rather than guessing at answers.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  opportunities: DraftOpportunity[],
): string {
  if (opportunities.length === 0) {
    return [
      `Problem: ${problemStatement}`,
      "",
      "The Opportunity Agent identified no candidate opportunities at all. Return an empty assessments list, an empty opportunityLandscape, and an opportunityRealityCheck signal of NO_CLEAR_OPPORTUNITY or INSUFFICIENT_EVIDENCE with an explanation grounded in that absence — do not invent an opportunity to assess.",
    ].join("\n");
  }

  const opportunityLines = opportunities
    .map((o) =>
      [
        `- [${o.opportunityId}] ${o.title} (${o.opportunityState}, confidence: ${o.confidence})`,
        `  Description: ${o.description}`,
        `  Unserved need (${o.unservedNeed.status}): ${o.unservedNeed.claim}`,
        `  Existing solution context (${o.existingSolutionContext.status}): ${o.existingSolutionContext.claim}`,
        `  Related pains: ${o.relatedPains.join(", ") || "(none)"}`,
        `  Related gaps: ${o.relatedGaps.join(", ") || "(none)"}`,
        `  Value potential: ${o.valuePotential.value}/100 (${o.valuePotential.confidence} confidence) — ${o.valuePotential.reasoning}`,
        `  Impact potential: ${o.impactPotential.value}/100 (${o.impactPotential.confidence} confidence) — ${o.impactPotential.reasoning}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `Problem: ${problemStatement}`,
    "",
    "Opportunities identified by the Opportunity Agent:",
    opportunityLines,
    "",
    "For every opportunity listed above, produce exactly one assessment (by its exact opportunityId), then rank the full set in the opportunity landscape and give one overall opportunity reality check.",
  ].join("\n");
}
