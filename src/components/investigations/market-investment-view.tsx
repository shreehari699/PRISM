import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { MarketNumberDisplay } from "@/components/investigations/market-number";
import { ScoreBar } from "@/components/investigations/score-bar";
import { StatusChip } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MarketInvestmentAnalysis } from "@/lib/phases/market-investment/schema";

/** Phase 06: market size, competitive landscape, and investment considerations for the leading opportunity. */
export function MarketInvestmentView({ output }: { output: MarketInvestmentAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-6">{output.marketSummary}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MarketNumberDisplay label="TAM" n={output.tamAnalysis.value} />
        <MarketNumberDisplay label="SAM" n={output.samAnalysis.value} />
        <MarketNumberDisplay label="SOM" n={output.somAnalysis.value} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.entries(output.marketScores).map(([key, score]) => (
          <ScoreBar key={key} label={key} score={score} />
        ))}
      </div>

      <Alert>
        <AlertTitle className="flex items-center gap-2">
          Market reality check <StatusChip status={output.marketRealityCheck.signal} />
        </AlertTitle>
        <AlertDescription>{output.marketRealityCheck.explanation}</AlertDescription>
      </Alert>

      <Alert>
        <AlertTitle>Investment reality check</AlertTitle>
        <AlertDescription>
          <GenericPhaseOutput value={output.investmentRealityCheck} />
        </AlertDescription>
      </Alert>

      <DetailsSection title="Market segments">
        <GenericPhaseOutput value={output.marketSegments} />
      </DetailsSection>
      <DetailsSection title="Competitive landscape">
        <GenericPhaseOutput value={output.competitiveLandscape} />
      </DetailsSection>
      <DetailsSection title="Business models" defaultOpen>
        <GenericPhaseOutput value={output.businessModels} />
      </DetailsSection>
      <DetailsSection title="Unit economics">
        <GenericPhaseOutput value={output.unitEconomics} />
      </DetailsSection>
      <DetailsSection title="Scalability">
        <GenericPhaseOutput value={output.scalability} />
      </DetailsSection>
      <DetailsSection title="Investment analysis">
        <GenericPhaseOutput value={output.investmentAnalysis} />
      </DetailsSection>
      <DetailsSection title="Valuation drivers">
        <GenericPhaseOutput value={output.valuationDrivers} />
      </DetailsSection>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
