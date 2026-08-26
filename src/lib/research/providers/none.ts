import type { ResearchProvider, ResearchQuery, ResearchResult } from "../types";

/**
 * Default provider when RESEARCH_PROVIDER=none or nothing is configured.
 * Reports honest unavailability — PRISM must never fabricate sources to
 * fill this gap, so every caller has to handle the "unavailable" branch
 * of ResearchResult explicitly.
 */
export class NoneResearchProvider implements ResearchProvider {
  readonly name = "none";
  readonly isConfigured = true;

  async search(_query: ResearchQuery): Promise<ResearchResult> {
    void _query;
    return {
      status: "unavailable",
      reason:
        "No research provider is configured (RESEARCH_PROVIDER=none). Set RESEARCH_PROVIDER and the matching API key to enable live research.",
      provider: this.name,
    };
  }
}
