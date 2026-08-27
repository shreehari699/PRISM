import type { PrismPhaseKey } from "@/lib/prism/phases";

/**
 * The logical agent roster. Each agent is a narrow, single-responsibility
 * role — never one giant prompt covering the whole investigation. Full
 * per-agent system instructions and structured output schemas are added
 * phase-by-phase as each PRISM phase is implemented; this registry is
 * the stable identity/metadata layer the orchestrator, database, and UI
 * key off of regardless of how a given agent is currently implemented.
 */
export type AgentId =
  | "problem_analyst"
  | "stakeholder_analyst"
  | "pain_analyst"
  | "research_agent"
  | "existing_solution_agent"
  | "gap_agent"
  | "opportunity_agent"
  | "innovation_agent"
  | "market_agent"
  | "investment_agent"
  | "feasibility_agent"
  | "solution_consultant"
  | "validation_agent"
  | "jury_agent"
  | "report_generator";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  phase: PrismPhaseKey;
  /** One-line responsibility boundary — what this agent does and, implicitly, what it doesn't. */
  responsibility: string;
  usesResearch: boolean;
}

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "problem_analyst",
    name: "Problem Analyst",
    phase: "problem_intelligence",
    responsibility:
      "Decomposes the raw problem statement into anatomy: who, what, where, when, why.",
    usesResearch: false,
  },
  {
    id: "stakeholder_analyst",
    name: "Stakeholder Analyst",
    phase: "stakeholder_pain",
    responsibility: "Identifies every stakeholder group touched by the problem.",
    usesResearch: false,
  },
  {
    id: "pain_analyst",
    name: "Pain Analyst",
    phase: "stakeholder_pain",
    responsibility:
      "Scores severity, frequency, and cost of each stakeholder's pain.",
    usesResearch: false,
  },
  {
    id: "research_agent",
    name: "Research Agent",
    phase: "existing_solutions",
    responsibility:
      "Runs external research queries and normalizes results into evidenced sources.",
    usesResearch: true,
  },
  {
    id: "existing_solution_agent",
    name: "Existing Solution Agent",
    phase: "existing_solutions",
    responsibility:
      "Extracts and structures existing solutions from research sources.",
    usesResearch: true,
  },
  {
    id: "gap_agent",
    name: "Gap Agent",
    phase: "gap_intelligence",
    responsibility:
      "Compares existing solutions against stakeholder pain to surface unaddressed gaps.",
    usesResearch: false,
  },
  {
    id: "opportunity_agent",
    name: "Opportunity Agent",
    phase: "opportunity_innovation",
    responsibility: "Turns validated gaps into candidate opportunities.",
    usesResearch: false,
  },
  {
    id: "innovation_agent",
    name: "Innovation Agent",
    phase: "opportunity_innovation",
    responsibility:
      "Proposes differentiated innovation directions for each opportunity.",
    usesResearch: false,
  },
  {
    id: "market_agent",
    name: "Market Agent",
    phase: "market_investment",
    responsibility: "Assesses market size and competitive landscape.",
    usesResearch: true,
  },
  {
    id: "investment_agent",
    name: "Investment Agent",
    phase: "market_investment",
    responsibility: "Assesses funding and cost considerations.",
    usesResearch: true,
  },
  {
    id: "feasibility_agent",
    name: "Feasibility Agent",
    phase: "technical_feasibility",
    responsibility:
      "Evaluates buildability against team, time, budget, and technology constraints.",
    usesResearch: false,
  },
  {
    id: "solution_consultant",
    name: "Solution Consultant",
    phase: "solution_consultant",
    responsibility:
      "Proposes a concrete solution architecture grounded in every prior phase.",
    usesResearch: false,
  },
  {
    id: "validation_agent",
    name: "Validation Agent",
    phase: "poc_validation",
    responsibility:
      "Adversarially validates the recommended solution — red-team critique, a simulated jury challenge, and a real-world validation plan — before deriving BUILD / PROCEED_WITH_CHANGES / VALIDATE_BEFORE_BUILD / DO_NOT_BUILD.",
    usesResearch: false,
  },
  {
    id: "jury_agent",
    name: "Jury Agent",
    phase: "intelligence_dossier",
    responsibility:
      "Evaluates the full investigation as an impartial judge and drafts the final decision.",
    usesResearch: false,
  },
  {
    id: "report_generator",
    name: "Report Generator",
    phase: "intelligence_dossier",
    responsibility:
      "Assembles the PRISM Intelligence Dossier from validated phase data only.",
    usesResearch: false,
  },
] as const;

export function getAgent(id: AgentId): AgentDefinition {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown agent id: ${id}`);
  return agent;
}

export function getAgentsForPhase(phase: PrismPhaseKey): AgentDefinition[] {
  return AGENTS.filter((a) => a.phase === phase);
}
