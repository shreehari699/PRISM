import { AlertTriangle } from "lucide-react";

import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { PhaseExecutiveSummary } from "@/components/investigations/phase-executive-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { SolutionConsultantAnalysis } from "@/lib/phases/solution-consultant/schema";

/** Phase 08: the concrete solution architecture — only proposed once every earlier phase's evidence supports it. */
export function SolutionConsultantView({ output }: { output: SolutionConsultantAnalysis }) {
  if (!output.solution) {
    return (
      <p className="text-sm text-muted-foreground">
        No solution is recommended — the evidence gathered so far doesn&apos;t support proposing one
        yet.
      </p>
    );
  }

  const { solution } = output;

  return (
    <div className="flex flex-col gap-6">
      <PhaseExecutiveSummary
        headline={`${solution.name} — ${solution.tagline}`}
        stats={[
          { label: "Core features", value: solution.coreFeatures.length },
          { label: "Risks", value: solution.risks.length },
          { label: "Acknowledged blockers", value: output.acknowledgedCriticalBlockers.length },
        ]}
      />

      <div className="rounded-lg border border-prism/20 bg-prism/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{solution.name}</h3>
          <Badge variant="outline">{solution.solutionType}</Badge>
        </div>
        <p className="mt-1 text-sm font-medium text-prism">{solution.tagline}</p>
        <p className="mt-3 text-sm leading-6">{solution.executiveSummary}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{solution.coreValueProposition}</p>
      </div>

      {output.acknowledgedCriticalBlockers.length > 0 ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Acknowledged critical blockers</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {output.acknowledgedCriticalBlockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <DetailsSection title="Why this solution" defaultOpen>
        <GenericPhaseOutput value={output.whyThisSolution} />
      </DetailsSection>
      <DetailsSection title="Feature scope" defaultOpen>
        <GenericPhaseOutput value={output.featureScope} />
      </DetailsSection>
      <DetailsSection title="Technology stack">
        <GenericPhaseOutput value={output.technologyStack} />
      </DetailsSection>
      <DetailsSection title="Data flow">
        <GenericPhaseOutput value={output.dataFlow} />
      </DetailsSection>
      {output.aiArchitecture ? (
        <DetailsSection title="AI architecture">
          <GenericPhaseOutput value={output.aiArchitecture} />
        </DetailsSection>
      ) : null}
      {output.engineeringSafety ? (
        <DetailsSection title="Engineering safety">
          <GenericPhaseOutput value={output.engineeringSafety} />
        </DetailsSection>
      ) : null}
      <DetailsSection title="Proof-of-concept definition" defaultOpen>
        <GenericPhaseOutput value={output.pocDefinition} />
      </DetailsSection>
      <DetailsSection title="Success metrics">
        <GenericPhaseOutput value={output.successMetrics} />
      </DetailsSection>
      <DetailsSection title="Mode-specific plan" defaultOpen>
        <GenericPhaseOutput value={output.modeSolutionPlan} />
      </DetailsSection>
      <DetailsSection title="Alternatives considered">
        <GenericPhaseOutput value={output.alternativesConsidered} />
      </DetailsSection>

      <Alert>
        <AlertTitle className="flex items-center gap-2">
          Reality check
        </AlertTitle>
        <AlertDescription>
          <GenericPhaseOutput value={output.solutionRealityCheck} />
        </AlertDescription>
      </Alert>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
