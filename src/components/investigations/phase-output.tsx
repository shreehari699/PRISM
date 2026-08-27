import { FeasibilityDashboard } from "@/components/investigations/feasibility-dashboard";
import { GapIntelligenceView } from "@/components/investigations/gap-intelligence-view";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";
import type { PrismPhaseKey } from "@/lib/prism/phases";

/**
 * Dispatches to a bespoke, phase-aware view for the phases that have one,
 * falling back to the schema-agnostic `GenericPhaseOutput` for every
 * other phase. Each bespoke view still only renders fields the real
 * persisted schema actually has — `safeParse` guards against ever
 * rendering a bespoke view against a shape it wasn't built for (an
 * upstream schema change would fail parsing and fall back honestly
 * rather than render garbage).
 */
export function PhaseOutput({ phaseKey, value }: { phaseKey: PrismPhaseKey; value: unknown }) {
  if (phaseKey === "gap_intelligence") {
    const parsed = gapIntelligenceAnalysisSchema.safeParse(value);
    if (parsed.success) return <GapIntelligenceView output={parsed.data} />;
  }

  if (phaseKey === "technical_feasibility") {
    const parsed = technicalFeasibilityAnalysisSchema.safeParse(value);
    if (parsed.success) return <FeasibilityDashboard output={parsed.data} />;
  }

  return <GenericPhaseOutput value={value} />;
}
