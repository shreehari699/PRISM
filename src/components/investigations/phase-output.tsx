import { DossierReport } from "@/components/investigations/dossier-report";
import { ExistingSolutionsView } from "@/components/investigations/existing-solutions-view";
import { FeasibilityDashboard } from "@/components/investigations/feasibility-dashboard";
import { GapIntelligenceView } from "@/components/investigations/gap-intelligence-view";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { MarketInvestmentView } from "@/components/investigations/market-investment-view";
import { OpportunityInnovationView } from "@/components/investigations/opportunity-innovation-view";
import { ProblemIntelligenceView } from "@/components/investigations/problem-intelligence-view";
import { RedTeamJuryView } from "@/components/investigations/red-team-jury-view";
import { SolutionConsultantView } from "@/components/investigations/solution-consultant-view";
import { StakeholderPainView } from "@/components/investigations/stakeholder-pain-view";
import { problemAnatomySchema } from "@/lib/agents/problem-analyst/schema";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { intelligenceDossierAnalysisSchema } from "@/lib/phases/intelligence-dossier/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { pocValidationAnalysisSchema } from "@/lib/phases/poc-validation/schema";
import { solutionConsultantAnalysisSchema } from "@/lib/phases/solution-consultant/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";
import type { PrismPhaseKey } from "@/lib/prism/phases";

/**
 * Dispatches to a bespoke, phase-aware view for every one of the ten
 * phases, falling back to the schema-agnostic `GenericPhaseOutput` if a
 * shape doesn't parse. Each bespoke view still only renders fields the
 * real persisted schema actually has — `safeParse` guards against ever
 * rendering a bespoke view against a shape it wasn't built for (an
 * upstream schema change would fail parsing and fall back honestly
 * rather than render garbage).
 */
export function PhaseOutput({ phaseKey, value }: { phaseKey: PrismPhaseKey; value: unknown }) {
  if (phaseKey === "problem_intelligence") {
    const parsed = problemAnatomySchema.safeParse(value);
    if (parsed.success) return <ProblemIntelligenceView output={parsed.data} />;
  }

  if (phaseKey === "stakeholder_pain") {
    const parsed = stakeholderPainAnalysisSchema.safeParse(value);
    if (parsed.success) return <StakeholderPainView output={parsed.data} />;
  }

  if (phaseKey === "existing_solutions") {
    const parsed = existingSolutionsAnalysisSchema.safeParse(value);
    if (parsed.success) return <ExistingSolutionsView output={parsed.data} />;
  }

  if (phaseKey === "gap_intelligence") {
    const parsed = gapIntelligenceAnalysisSchema.safeParse(value);
    if (parsed.success) return <GapIntelligenceView output={parsed.data} />;
  }

  if (phaseKey === "opportunity_innovation") {
    const parsed = opportunityInnovationAnalysisSchema.safeParse(value);
    if (parsed.success) return <OpportunityInnovationView output={parsed.data} />;
  }

  if (phaseKey === "market_investment") {
    const parsed = marketInvestmentAnalysisSchema.safeParse(value);
    if (parsed.success) return <MarketInvestmentView output={parsed.data} />;
  }

  if (phaseKey === "technical_feasibility") {
    const parsed = technicalFeasibilityAnalysisSchema.safeParse(value);
    if (parsed.success) return <FeasibilityDashboard output={parsed.data} />;
  }

  if (phaseKey === "solution_consultant") {
    const parsed = solutionConsultantAnalysisSchema.safeParse(value);
    if (parsed.success) return <SolutionConsultantView output={parsed.data} />;
  }

  if (phaseKey === "poc_validation") {
    const parsed = pocValidationAnalysisSchema.safeParse(value);
    if (parsed.success) return <RedTeamJuryView output={parsed.data} />;
  }

  if (phaseKey === "intelligence_dossier") {
    const parsed = intelligenceDossierAnalysisSchema.safeParse(value);
    if (parsed.success) return <DossierReport dossier={parsed.data} />;
  }

  return <GenericPhaseOutput value={value} />;
}
