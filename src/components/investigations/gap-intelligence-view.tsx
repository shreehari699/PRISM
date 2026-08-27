import { DetailsSection } from "@/components/investigations/details-section";
import { GapFlowDiagram } from "@/components/investigations/gap-flow-diagram";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { StatusChip } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { GapIntelligenceAnalysis } from "@/lib/phases/gap-intelligence/schema";

export function GapIntelligenceView({ output }: { output: GapIntelligenceAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Badge variant="destructive">{output.confirmedGaps.length} confirmed</Badge>
        <Badge variant="assumption">{output.candidateGaps.length} candidate</Badge>
        <Badge variant="unknown">{output.unverifiedGaps.length} unverified</Badge>
        <Badge variant="verified">{output.noGapFindings.length} already covered</Badge>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Gap analysis</h3>
        <GapFlowDiagram gaps={output.gapCandidates} coverageMatrix={output.coverageMatrix} />
      </div>

      <Alert>
        <AlertTitle className="flex items-center gap-2">
          Reality check <StatusChip status={output.gapRealityCheck.signal} />
        </AlertTitle>
        <AlertDescription>{output.gapRealityCheck.explanation}</AlertDescription>
      </Alert>

      <DetailsSection title="Coverage matrix">
        <GenericPhaseOutput value={output.coverageMatrix} />
      </DetailsSection>

      <DetailsSection title="Gap priority">
        <GenericPhaseOutput value={output.gapPriority} />
      </DetailsSection>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
