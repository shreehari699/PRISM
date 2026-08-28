import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { PhaseExecutiveSummary } from "@/components/investigations/phase-executive-summary";
import { ScoreBar } from "@/components/investigations/score-bar";
import { StatusChip } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { OpportunityInnovationAnalysis } from "@/lib/phases/opportunity-innovation/schema";

/** Phase 05: candidate opportunities turned into differentiated innovation directions — or an honest "no meaningful opportunity." */
export function OpportunityInnovationView({ output }: { output: OpportunityInnovationAnalysis }) {
  const leading = [...output.opportunities].sort(
    (a, b) => b.valuePotential.value - a.valuePotential.value,
  )[0];

  return (
    <div className="flex flex-col gap-6">
      <PhaseExecutiveSummary
        headline={
          leading
            ? `Leading opportunity: ${leading.title}`
            : `No meaningful opportunity emerged (${output.overallFinding.replace(/_/g, " ").toLowerCase()}).`
        }
        stats={[{ label: "Opportunities", value: output.opportunities.length }]}
        confidence={leading ? <StatusChip status={leading.opportunityState} /> : undefined}
      />

      <Alert variant={output.overallFinding === "NO_MEANINGFUL_OPPORTUNITY" ? "warning" : "default"}>
        <AlertTitle>{output.overallFinding.replace(/_/g, " ")}</AlertTitle>
      </Alert>

      {leading ? (
        <div className="rounded-lg border border-prism/20 bg-prism/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{leading.title}</p>
            <StatusChip status={leading.opportunityState} />
          </div>
          <p className="mt-1 text-sm leading-6">{leading.description}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{leading.unservedNeed.claim}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScoreBar label="Value potential" score={leading.valuePotential} />
            <ScoreBar label="Impact potential" score={leading.impactPotential} />
            <ScoreBar label="Innovation potential" score={leading.innovationPotential} />
            <ScoreBar label="Feasibility potential" score={leading.feasibilityPotential} />
          </div>
          {leading.innovationDirections.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {leading.innovationDirections.map((d, i) => (
                <Badge key={i} variant="outline">
                  {d.directionType}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No candidate opportunities were identified.</p>
      )}

      <DetailsSection title={`Opportunity landscape (${output.opportunityLandscape.length})`} defaultOpen>
        <GenericPhaseOutput value={output.opportunityLandscape} />
      </DetailsSection>

      <DetailsSection title={`All opportunities (${output.opportunities.length})`}>
        <GenericPhaseOutput value={output.opportunities} />
      </DetailsSection>

      <Alert>
        <AlertTitle className="flex items-center gap-2">
          Reality check <StatusChip status={output.opportunityRealityCheck.signal} />
        </AlertTitle>
        <AlertDescription>{output.opportunityRealityCheck.explanation}</AlertDescription>
      </Alert>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
