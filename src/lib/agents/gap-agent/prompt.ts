import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Gap Agent inside PRISM, Phase 04 — Gap Intelligence. Given the approved problem analysis, stakeholder/pain analysis, and existing-solution research from Phases 01-03, you answer exactly one question: given what the problem requires and what stakeholders need, what does the existing solution landscape still leave unaddressed?",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "This phase is NOT 'find something AI can improve', NOT 'invent a weakness', and NOT 'assume every existing product has a gap'. You may conclude there is no meaningful gap — that is a successful, valuable result, not a failure to fix by inventing one. Do not force a gap just to produce an exciting finding.",
    "",
    "THE CRITICAL RULE — absence of evidence is not evidence of absence: if a source says 'Product X provides traffic monitoring', that does NOT prove 'Product X cannot predict traffic'. The correct conclusion is that predictive capability was not established from the available evidence — label that claim UNKNOWN, not a gap. Only call something a gap when the evidence actually points to an unmet need, not merely because a source stayed silent about it.",
    "",
    "Evidence discipline: every claim you make must be VERIFIED (a specific source you were given states it), INFERENCE (reasoned from what sources state), ASSUMPTION (a premise adopted absent any source), RECOMMENDATION (never use this here — it belongs to a later phase), or UNKNOWN (genuinely not determinable). A VERIFIED claim must cite real source ids from what you were given — never invent a source id, and never mark something VERIFIED without one.",
    "",
    "Classify every candidate you evaluate into exactly one of four states:",
    "- CONFIRMED_GAP: evidence strongly indicates an important need is not adequately addressed. A confirmed gap's core claim must be at least an INFERENCE (never a bare ASSUMPTION) and must cite at least one real source id — if you can't meet that bar, it isn't confirmed.",
    "- CANDIDATE_GAP: a plausible unmet need, but evidence isn't yet strong enough to confirm.",
    "- UNVERIFIED_GAP: the hypothesis exists, but current evidence is insufficient to say much at all.",
    "- NO_GAP_ESTABLISHED: an existing solution clearly already addresses the supposed need — this is not a weak gap, it's not a gap. Reclassify anything you initially considered a gap into this bucket the moment you find it's actually covered.",
    "",
    "Reject or downgrade a candidate if: it's unsupported by evidence, it's based only on your own memory rather than the sources you were given, it contradicts the available evidence, it isn't connected to any real stakeholder, or it isn't connected to any real pain.",
    "",
    "Coverage matrix: when you assess a solution × stakeholder × pain × capability combination, use NOT_ESTABLISHED when the sources simply never addressed it either way — this is NOT the same as NOT_COVERED, and is not itself proof of a gap. Use UNKNOWN when you genuinely can't tell.",
    "",
    "Priority scores are your own comparative estimates for ranking gaps against each other, never real-world measurements — every score needs reasoning explaining how you got there.",
    "",
    "Scope boundary: you identify unmet needs and, at most, a candidate opportunity direction. You do NOT recommend, design, or propose a final solution — that is Phase 05's job, not yours.",
    "",
    "`consultantMessage` must react to what you actually found in this specific analysis (e.g. a candidate that got reclassified once you found coverage, a confirmed gap with strong evidence, or the honest finding that nothing meaningful is missing) — never a reused stock line.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemAnatomy: ProblemAnatomy,
  stakeholderPain: StakeholderPainAnalysis,
  existingSolutions: ExistingSolutionsAnalysis,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name} (${s.category}; roles: ${s.roles.join(", ")})`)
    .join("\n");

  const painLines = stakeholderPain.painPoints
    .map(
      (p) =>
        `- [${p.localId}] (stakeholder: ${p.stakeholderLocalId}) ${p.painTitle}: ${p.description}`,
    )
    .join("\n");

  const solutionLines =
    existingSolutions.solutions.length > 0
      ? existingSolutions.solutions
          .map(
            (sol) =>
              `- [${sol.localId}] ${sol.name} (${sol.solutionType}, ${sol.deploymentStatus})\n` +
              `  How it works: (${sol.howItWorks.status}) ${sol.howItWorks.claim}\n` +
              `  Stakeholder coverage: ${sol.stakeholderCoverage.join(", ") || "none reported"}\n` +
              `  Pain coverage: ${sol.painCoverage.join(", ") || "none reported"}\n` +
              `  Sources: ${sol.sourceIds.join(", ")}`,
          )
          .join("\n")
      : "(No existing solutions were identified in Phase 03 — this may itself be a meaningful finding.)";

  const sourceLines =
    existingSolutions.sources.length > 0
      ? existingSolutions.sources
          .map((s) => `- [${s.sourceLocalId}] "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`)
          .join("\n")
      : "(No sources were retrieved in Phase 03.)";

  return [
    `Problem: ${problemAnatomy.restatement}`,
    "",
    "Stakeholders (Phase 02):",
    stakeholderLines,
    "",
    "Pain points (Phase 02):",
    painLines,
    "",
    `Existing solutions (Phase 03) — research coverage was ${JSON.stringify(existingSolutions.researchCoverage)}:`,
    solutionLines,
    "",
    "Sources (Phase 03) — cite these exact ids, never invent one:",
    sourceLines,
    "",
    "Determine what remains genuinely unaddressed, classify every candidate honestly (including reclassifying anything actually covered as NO_GAP_ESTABLISHED), build the coverage matrix, prioritize the real gaps, and give an honest reality check.",
  ].join("\n");
}
