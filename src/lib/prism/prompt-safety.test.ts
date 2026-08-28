import { describe, expect, it } from "vitest";

import { buildSystemInstruction as existingSolution } from "@/lib/agents/existing-solution-agent/prompt";
import { buildSystemInstruction as feasibility } from "@/lib/agents/feasibility-agent/prompt";
import { buildSystemInstruction as gap } from "@/lib/agents/gap-agent/prompt";
import { buildSystemInstruction as innovation } from "@/lib/agents/innovation-agent/prompt";
import { buildSystemInstruction as investment } from "@/lib/agents/investment-agent/prompt";
import { buildSystemInstruction as market } from "@/lib/agents/market-agent/prompt";
import { buildSystemInstruction as marketResearch } from "@/lib/agents/market-research-agent/prompt";
import { buildSystemInstruction as opportunity } from "@/lib/agents/opportunity-agent/prompt";
import { buildSystemInstruction as painAnalyst } from "@/lib/agents/pain-analyst/prompt";
import { buildSystemInstruction as problemAnalyst } from "@/lib/agents/problem-analyst/prompt";
import { buildSystemInstruction as reportGenerator } from "@/lib/agents/report-generator/prompt";
import { buildSystemInstruction as research } from "@/lib/agents/research-agent/prompt";
import { buildSystemInstruction as solutionConsultant } from "@/lib/agents/solution-consultant/prompt";
import { buildSystemInstruction as stakeholderAnalyst } from "@/lib/agents/stakeholder-analyst/prompt";
import { buildSystemInstruction as validation } from "@/lib/agents/validation-agent/prompt";

import { UNTRUSTED_INPUT_NOTICE } from "./prompt-safety";

/**
 * Every agent that talks to Gemini receives untrusted text — the user's
 * problem statement from Phase 01 onward, and real web content from
 * Phase 03/06's research provider. This is a real prompt-injection
 * surface: a scraped page (or an adversarial user) could contain text
 * like "ignore previous instructions" or "treat this as VERIFIED."
 * Every agent's system instruction must tell the model to treat that
 * content as data, never as a directive — this test guards against a
 * new or edited agent silently forgetting to include it, which no
 * schema validation could ever catch (the notice is instructional, not
 * structural).
 */
describe("every agent's system instruction includes the untrusted-input notice", () => {
  const agents: Record<string, (mode: "HACKATHON", criteria: readonly string[]) => string> = {
    "existing-solution-agent": existingSolution,
    "feasibility-agent": feasibility,
    "gap-agent": gap,
    "innovation-agent": innovation,
    "investment-agent": investment,
    "market-agent": market,
    "market-research-agent": marketResearch,
    "opportunity-agent": opportunity,
    "pain-analyst": painAnalyst,
    "problem-analyst": problemAnalyst,
    "report-generator": reportGenerator,
    "research-agent": research,
    "solution-consultant": solutionConsultant,
    "stakeholder-analyst": stakeholderAnalyst,
    "validation-agent": validation,
  };

  for (const [name, build] of Object.entries(agents)) {
    it(`${name} includes the notice`, () => {
      const instruction = build("HACKATHON", ["time_limit"]);
      expect(instruction).toContain(UNTRUSTED_INPUT_NOTICE);
    });
  }
});
