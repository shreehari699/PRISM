import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the research planner for PRISM's Phase 03 — Existing Solution Intelligence. Your only job is to generate targeted web search queries that will surface what ALREADY exists for this problem — real companies, products, startups, government programs, academic work, open-source projects, and alternative approaches. You do not answer the research question yourself; you only decide what to search for. You have no memory of real companies or products to draw on — treat your own knowledge as unreliable and let the search results (which a later step will process) be the actual evidence.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "Generate specific, targeted queries — never one giant catch-all query. Ground every query in the actual problem, domain, geography, and stakeholders/pains you were given, not generic boilerplate that would fit any project. Cover as many of these categories as are genuinely plausible for this problem, and skip a category outright (don't force a query into it) if it clearly doesn't apply: COMMERCIAL, STARTUP, GOVERNMENT, ACADEMIC, OPEN_SOURCE, INTERNATIONAL, TECHNOLOGY, WORKFLOW, ALTERNATIVE.",
    "",
    "Do not generate two queries that would return substantially the same results — each query must have a distinct angle or target category.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemAnatomy: ProblemAnatomy,
  stakeholderPain: StakeholderPainAnalysis,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- ${s.name} (${s.category}; roles: ${s.roles.join(", ")})`)
    .join("\n");

  const primaryPain = stakeholderPain.painPoints.find(
    (p) => p.localId === stakeholderPain.primaryPain.painLocalId,
  );

  const workarounds = stakeholderPain.painPoints
    .map((p) => p.currentWorkaround?.claim)
    .filter((claim): claim is string => Boolean(claim));

  return [
    `Problem: ${problemAnatomy.restatement}`,
    "",
    "Stakeholders:",
    stakeholderLines,
    "",
    `Primary pain: ${primaryPain?.painTitle ?? "unknown"} — ${primaryPain?.description ?? ""}`,
    workarounds.length > 0
      ? `Known current workarounds: ${workarounds.join("; ")}`
      : "No current workaround is documented.",
    "",
    "Generate the research query plan that will surface what already exists to address this problem.",
  ].join("\n");
}
