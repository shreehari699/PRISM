/**
 * Builds what the PRISM voice consultant says for each dialogue moment.
 * Every function takes real, already-computed values pulled from actual
 * backend output — a phase title, a real count, a real decision — and
 * interpolates them into the line. Nothing here is one fixed sentence
 * spoken for every investigation: change the inputs (a different
 * problem, a different verdict, a different blocker) and the line
 * changes with them.
 */

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

export function welcomeDialogue(problemStatement: string): string {
  return `Welcome to PRISM. You brought me a problem: "${truncate(problemStatement, 140)}." Before your team spends hours building a solution, let's find out whether it deserves one.`;
}

export function phaseTransitionDialogue(phaseOrder: number, phaseTitle: string): string {
  return `Phase ${String(phaseOrder).padStart(2, "0")}: ${phaseTitle}. Let's look closer.`;
}

/** Spoken once, the first time a given phase is opened this session — what PRISM is about to do, from that phase's own real description. */
export function phaseOpenDialogue(phaseTitle: string, phaseDescription: string): string {
  return `${phaseTitle}. ${phaseDescription}`;
}

/** Spoken when a phase run/regenerate finishes — `findings` is a real, dynamic sentence built from that phase's own actual output, never a fixed line. */
export function phaseCompleteDialogue(phaseTitle: string, findings: string | null): string {
  return findings
    ? `${phaseTitle} is complete. ${findings}`
    : `${phaseTitle} is complete and ready for your review.`;
}

export function discoveryDialogue(headline: string, detail?: string): string {
  return detail ? `Here's what I found: ${headline}. ${detail}` : `Here's what I found: ${headline}.`;
}

export function warningDialogue(headline: string, detail?: string): string {
  return detail
    ? `I need to flag something. ${headline}. ${detail}`
    : `I need to flag something. ${headline}.`;
}

export function researchDialogue(sourceCount: number, topic: string): string {
  if (sourceCount === 0) {
    return `I searched the existing landscape for ${topic}, and came back with nothing solid enough to cite.`;
  }
  return `I searched the existing landscape for ${topic} and found ${sourceCount} source${sourceCount === 1 ? "" : "s"} worth weighing.`;
}

export function redTeamIntroDialogue(): string {
  return "Enough being nice. Let's try to break this idea before a real judge does.";
}

export function redTeamDialogue(strongestAttack: string): string {
  return `Here's the strongest attack on this idea: ${strongestAttack}`;
}

export function verdictDialogue(decision: string, confidence: string, reason: string): string {
  const decisionLine: Record<string, string> = {
    BUILD: "The evidence is strong enough. It's time to build.",
    BUILD_WITH_CHANGES: "Your idea is interesting. But I'd change one thing before you build it.",
    VALIDATE_BEFORE_BUILD:
      "Don't spend the next few weeks building something we haven't validated yet.",
    RESEARCH_BEFORE_BUILD: "The problem is real. The research isn't finished yet.",
    DO_NOT_BUILD: "The problem is real. The solution isn't ready — and I don't think this one gets there.",
    INSUFFICIENT_EVIDENCE: "I don't have enough evidence yet to tell you build or don't.",
  };
  const opening = decisionLine[decision] ?? "Here's my verdict.";
  return `We've gone through this from every angle. ${opening} My confidence is ${confidence.toLowerCase()}. ${reason}`;
}
