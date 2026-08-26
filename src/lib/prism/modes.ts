import { z } from "zod";

export const projectModeSchema = z.enum([
  "HACKATHON",
  "PBL",
  "STARTUP",
  "RESEARCH",
  "ZERO_DEGREE",
]);

export type ProjectMode = z.infer<typeof projectModeSchema>;

/**
 * Per-mode evaluation criteria. These drive which lenses each agent
 * applies during a phase — e.g. Feasibility Agent under HACKATHON weighs
 * "demo feasibility in 36 hours" while under STARTUP it weighs
 * "scalability and unit economics" instead.
 */
export const MODE_CRITERIA: Record<ProjectMode, readonly string[]> = {
  HACKATHON: [
    "time_limit",
    "mvp_scope",
    "demo_feasibility",
    "judge_impact",
    "prototype_feasibility",
  ],
  PBL: [
    "objectives",
    "methodology",
    "literature",
    "architecture",
    "implementation",
    "testing",
    "results",
    "discussion",
    "conclusion",
    "future_scope",
  ],
  STARTUP: [
    "customer",
    "buyer",
    "market",
    "business_model",
    "competition",
    "scalability",
    "economics",
    "investment_considerations",
  ],
  RESEARCH: [
    "research_question",
    "literature",
    "gap",
    "methodology",
    "evidence",
    "limitations",
  ],
  ZERO_DEGREE: [
    "strategic_relevance",
    "internal_capability",
    "reusable_technology",
    "product_potential",
    "long_term_research_value",
    "team_fit",
  ],
} as const;

export const MODE_LABELS: Record<ProjectMode, string> = {
  HACKATHON: "Hackathon",
  PBL: "Project-Based Learning",
  STARTUP: "Startup",
  RESEARCH: "Research",
  ZERO_DEGREE: "Zero Degree",
};
