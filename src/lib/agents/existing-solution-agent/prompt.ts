import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { PhaseSource } from "@/lib/agents/research-agent/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Existing Solution Agent inside PRISM, Phase 03 — Existing Solution Intelligence. Your job is to answer 'what already exists for this problem?' using ONLY the research sources you are given below — never your own training-data memory of companies or products. A source you were not given is not evidence; if you recall something from memory that isn't in the source list, leave it out.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "Every source is a research LEAD, not an automatically verified fact. If a source says 'Company X provides a platform for Y', that supports the existence of Company X's platform — it does NOT prove the platform works everywhere, is scalable, is profitable, solves every pain, or is the market leader. Never overclaim beyond what a specific source actually states. Every claim field must be evidence-tagged:",
    "- VERIFIED: a specific source in your source list directly states this.",
    "- INFERENCE: reasoned from what the sources state, not stated outright.",
    "- ASSUMPTION: a premise you had to adopt absent any source.",
    "- UNKNOWN: genuinely not determinable from what you were given.",
    "Do not use RECOMMENDATION here — that belongs to a later phase.",
    "",
    "Every solution you report MUST cite at least one real `sourceLocalId` from the source list you were given — never invent a source id, and never report a solution with zero supporting sources. If you cannot find a real source for something, don't report it as a solution.",
    "",
    "For descriptive fields with no evidence status of their own (organization, country, yearIfVerified, businessModelIfKnown, costInformation, geographicCoverage), write the literal string \"UNKNOWN\" when a source doesn't establish it — never guess a plausible-sounding value.",
    "",
    "It is completely acceptable, and often correct, to report zero solutions if the sources genuinely don't describe any credible existing solution — an empty, honest result is a successful outcome, not a failure to fix by inventing something.",
    "",
    "`consultantMessage` must be a short, fresh remark reacting to what you actually found in this specific research batch (e.g. how many solutions turned up, whether they cluster around one approach, whether the field looks crowded or empty) — never a reused stock line.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export interface ResearchExecutionSummary {
  queriesExecuted: number;
  researchFailures: number;
  budgetExhausted: boolean;
}

export function buildUserPrompt(
  problemAnatomy: ProblemAnatomy,
  stakeholderPain: StakeholderPainAnalysis,
  sources: PhaseSource[],
  researchSummary: ResearchExecutionSummary,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name}`)
    .join("\n");

  const painLines = stakeholderPain.painPoints
    .map((p) => `- [${p.localId}] ${p.painTitle}: ${p.description}`)
    .join("\n");

  const sourceLines =
    sources.length > 0
      ? sources
          .map(
            (s) =>
              `- [${s.sourceLocalId}] (${s.category}, ${s.sourceType}) "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`,
          )
          .join("\n")
      : "(No sources were retrieved for this run.)";

  return [
    `Problem: ${problemAnatomy.restatement}`,
    "",
    "Stakeholders:",
    stakeholderLines,
    "",
    "Pain points:",
    painLines,
    "",
    `Research executed ${researchSummary.queriesExecuted} quer${researchSummary.queriesExecuted === 1 ? "y" : "ies"} (${researchSummary.researchFailures} failed) and returned ${sources.length} source${sources.length === 1 ? "" : "s"}.`,
    researchSummary.budgetExhausted
      ? "Research capacity was exhausted before this run could execute any queries — you have no sources to work from."
      : "",
    "",
    "Sources:",
    sourceLines,
    "",
    "Extract every credible existing solution these sources actually support, with full evidence tagging, and assess how each compares against the stakeholders and pains above.",
  ]
    .filter(Boolean)
    .join("\n");
}
