/**
 * The ten PRISM investigation phases, in required order. This is the
 * backbone the orchestrator, database schema, and UI progress indicator
 * all key off of — the phase key is stored verbatim in
 * `analysis_phases.phase_key`.
 */
export const PRISM_PHASES = [
  {
    key: "problem_intelligence",
    order: 1,
    title: "Problem Intelligence",
    shortTitle: "Problem",
    description:
      "Decompose the raw problem statement into its anatomy: who is affected, what triggers it, where and when it occurs, and why it persists.",
    agents: ["problem_analyst"],
    requiresApproval: true,
  },
  {
    key: "stakeholder_pain",
    order: 2,
    title: "Stakeholder & Pain Analysis",
    shortTitle: "Stakeholders",
    description:
      "Identify every stakeholder group touched by the problem and score the severity, frequency, and cost of their pain.",
    agents: ["stakeholder_analyst", "pain_analyst"],
    requiresApproval: true,
  },
  {
    key: "existing_solutions",
    order: 3,
    title: "Existing Solution Intelligence",
    shortTitle: "Existing Solutions",
    description:
      "Research who else already addresses this problem — academic, commercial, open-source, and government — with cited evidence.",
    agents: ["research_agent", "existing_solution_agent"],
    requiresApproval: false,
  },
  {
    key: "gap_intelligence",
    order: 4,
    title: "Gap Intelligence",
    shortTitle: "Gaps",
    description:
      "Compare existing solutions against stakeholder pain to find what remains unaddressed, and how confidently that gap is evidenced.",
    agents: ["gap_agent"],
    requiresApproval: true,
  },
  {
    key: "opportunity_innovation",
    order: 5,
    title: "Opportunity & Innovation",
    shortTitle: "Opportunity",
    description:
      "Turn validated gaps into candidate opportunities and differentiated innovation directions.",
    agents: ["opportunity_agent", "innovation_agent"],
    requiresApproval: true,
  },
  {
    key: "market_investment",
    order: 6,
    title: "Market & Investment Intelligence",
    shortTitle: "Market",
    description:
      "Assess market size, competitive landscape, and investment considerations for the leading opportunity.",
    agents: ["market_agent", "investment_agent"],
    requiresApproval: false,
  },
  {
    key: "technical_feasibility",
    order: 7,
    title: "Technical Feasibility",
    shortTitle: "Feasibility",
    description:
      "Evaluate whether the opportunity can realistically be built given team, time, budget, and technology constraints.",
    agents: ["feasibility_agent"],
    requiresApproval: true,
  },
  {
    key: "solution_consultant",
    order: 8,
    title: "Solution Consultant",
    shortTitle: "Solution",
    description:
      "Only now propose a concrete solution architecture, grounded in every prior phase rather than invented up front.",
    agents: ["solution_consultant"],
    requiresApproval: true,
  },
  {
    key: "poc_validation",
    order: 9,
    title: "POC / Validation",
    shortTitle: "Validation",
    description:
      "Define a proof-of-concept plan and validation criteria, and record actual validation results as they come in.",
    agents: ["validation_agent"],
    requiresApproval: true,
  },
  {
    key: "intelligence_dossier",
    order: 10,
    title: "PRISM Intelligence Dossier",
    shortTitle: "Dossier",
    description:
      "Compile every validated phase output, plus a jury evaluation and final BUILD / RESEARCH FURTHER / PARK / REJECT decision, into the final report.",
    agents: ["jury_agent", "report_generator"],
    requiresApproval: false,
  },
] as const;

export type PrismPhaseKey = (typeof PRISM_PHASES)[number]["key"];

export type PrismPhaseDefinition = (typeof PRISM_PHASES)[number];

export const PHASE_KEYS = PRISM_PHASES.map((p) => p.key) as PrismPhaseKey[];

export function getPhaseDefinition(key: PrismPhaseKey): PrismPhaseDefinition {
  const phase = PRISM_PHASES.find((p) => p.key === key);
  if (!phase) {
    throw new Error(`Unknown PRISM phase key: ${key}`);
  }
  return phase;
}

export function getPhaseByOrder(order: number): PrismPhaseDefinition | undefined {
  return PRISM_PHASES.find((p) => p.order === order);
}

export function nextPhase(key: PrismPhaseKey): PrismPhaseDefinition | undefined {
  const current = getPhaseDefinition(key);
  return getPhaseByOrder(current.order + 1);
}

export function previousPhase(
  key: PrismPhaseKey,
): PrismPhaseDefinition | undefined {
  const current = getPhaseDefinition(key);
  return getPhaseByOrder(current.order - 1);
}

/** Phases whose output, once changed, invalidates the given downstream phase. */
export function upstreamPhasesOf(key: PrismPhaseKey): PrismPhaseKey[] {
  const current = getPhaseDefinition(key);
  return PRISM_PHASES.filter((p) => p.order < current.order).map((p) => p.key);
}

export function downstreamPhasesOf(key: PrismPhaseKey): PrismPhaseKey[] {
  const current = getPhaseDefinition(key);
  return PRISM_PHASES.filter((p) => p.order > current.order).map((p) => p.key);
}
