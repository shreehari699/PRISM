import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";
import { UNTRUSTED_INPUT_NOTICE } from "@/lib/prism/prompt-safety";

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Opportunity Agent inside PRISM, Phase 05 — Opportunity & Innovation Intelligence. Given the approved problem, stakeholder/pain, existing-solution, and gap analyses from Phases 01-04, you identify which of the gaps actually represent a meaningful opportunity worth exploring further.",
    "",
    UNTRUSTED_INPUT_NOTICE,
    "",
    "This is NOT 'generate 10 startup ideas', NOT 'put AI into everything', and NOT 'invent a futuristic solution'. Every opportunity you propose must emerge from the evidence already collected — a gap with no real stakeholder or pain behind it is not an opportunity, it's noise.",
    "",
    "Only build opportunities from CONFIRMED_GAP or CANDIDATE_GAP entries as a rule — an UNVERIFIED_GAP may become an opportunity only if you can independently ground it in real stakeholder/pain evidence, and a gap classified NO_GAP_ESTABLISHED should never become an opportunity at all, since an existing solution already covers it.",
    "",
    "CRITICAL — three separate id namespaces, never interchange them: `relatedGaps` takes Phase 04 gap ids from the 'Gap candidates' list below (e.g. GAP-001). `affectedStakeholders`/`relatedPains` take Phase 02 stakeholder/pain ids from the lists below. `sourceIds` on `unservedNeed`, `existingSolutionContext`, and every entry in `evidenceClaims` takes ONLY real research source ids from the 'Research sources' list below (e.g. source-3) — never a gap id, a stakeholder id, a pain id, or an opportunity id. If a claim isn't actually grounded in one of the listed research sources, leave `sourceIds` empty and use INFERENCE or ASSUMPTION, not a fabricated citation.",
    "",
    "Classify every opportunity into exactly one state:",
    "- STRONG_OPPORTUNITY: strong, well-evidenced unmet need with clear stakeholder and pain grounding.",
    "- PROMISING_OPPORTUNITY: real signal, but evidence has real gaps.",
    "- EXPLORATORY_OPPORTUNITY: plausible, but mostly speculative at this point.",
    "- INSUFFICIENT_EVIDENCE: the hypothesis exists but there isn't enough to say much.",
    "Do not force every candidate into a strong opportunity — most real analyses will have a mix, and it is entirely acceptable to conclude there is no meaningful opportunity at all (an empty list is a valid, honest result).",
    "",
    "'Why now' factors (technology readiness, market shift, policy change, behavior change, infrastructure change, cost reduction, new data availability, new regulations, new unmet demand) must only be marked VERIFIED when the evidence you were given actually supports them — otherwise INFERENCE, ASSUMPTION, or UNKNOWN. Do not fabricate a trend because it would make the opportunity sound more timely.",
    "",
    "Impact assessment: only include dimensions (user, community, industry, government, economic, environmental, social, operational) that are genuinely relevant to this specific opportunity — never pad out the full list, and never fabricate a number; qualitative, evidence-tagged impact is what's wanted here.",
    "",
    "Scores (valuePotential, impactPotential) are your own comparative estimates, not real-world measurements — every score's reasoning must explain how you got there from the evidence.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemAnatomy: ProblemAnatomy,
  stakeholderPain: StakeholderPainAnalysis,
  existingSolutions: ExistingSolutionsAnalysis,
  gapIntelligence: GapIntelligenceAnalysis,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name} (${s.category})`)
    .join("\n");

  const painLines = stakeholderPain.painPoints
    .map((p) => `- [${p.localId}] ${p.painTitle}: ${p.description}`)
    .join("\n");

  const gapLines =
    gapIntelligence.gapCandidates.length > 0
      ? gapIntelligence.gapCandidates
          .map(
            (g) =>
              `- [${g.gapId}] (${g.gapState}, ${g.confidence}) ${g.title}: ${g.description}`,
          )
          .join("\n")
      : "(Phase 04 identified no gap candidates at all.)";

  const solutionLines =
    existingSolutions.solutions.length > 0
      ? existingSolutions.solutions.map((s) => `- [${s.localId}] ${s.name}`).join("\n")
      : "(No existing solutions were identified in Phase 03.)";

  const sourceLines =
    existingSolutions.sources.length > 0
      ? existingSolutions.sources
          .map((s) => `- [${s.sourceLocalId}] "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`)
          .join("\n")
      : "(No research sources are available — every claim you make must be INFERENCE, ASSUMPTION, or UNKNOWN, never VERIFIED, and `sourceIds` must stay empty.)";

  return [
    `Problem: ${problemAnatomy.restatement}`,
    "",
    "Stakeholders (Phase 02):",
    stakeholderLines,
    "",
    "Pain points (Phase 02):",
    painLines,
    "",
    "Existing solutions (Phase 03):",
    solutionLines,
    "",
    "Research sources (Phase 03) — the ONLY valid values for any `sourceIds` field:",
    sourceLines,
    "",
    `Gap candidates (Phase 04) — reality check was "${gapIntelligence.gapRealityCheck.signal}": ${gapIntelligence.gapRealityCheck.explanation}`,
    gapLines,
    "",
    "Identify every genuinely meaningful opportunity these gaps point to, each traceable to real stakeholders, pains, and gaps above. If nothing here rises to a meaningful opportunity, say so by returning an empty list rather than inventing one.",
  ].join("\n");
}
