import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { StatusChip } from "@/components/investigations/status-chip";
import { Badge } from "@/components/ui/badge";
import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";

const COVERAGE_LABELS: Record<keyof ExistingSolutionsAnalysis["researchCoverage"], string> = {
  commercial: "Commercial",
  government: "Government",
  academic: "Academic",
  startup: "Startup",
  openSource: "Open source",
  international: "International",
  technology: "Technology",
};

/** Phase 03: who else already addresses this problem, and how thoroughly PRISM's own research covered the landscape. */
export function ExistingSolutionsView({ output }: { output: ExistingSolutionsAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(output.stats).map(([key, value]) => (
          <div key={key} className="rounded-md border border-border p-3 text-center">
            <p className="text-xl font-semibold tabular-nums">{String(value)}</p>
            <p className="mt-1 text-xs text-muted-foreground capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Research coverage
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(COVERAGE_LABELS) as (keyof typeof COVERAGE_LABELS)[]).map((key) => (
            <div key={key} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
              <span className="text-xs">{COVERAGE_LABELS[key]}</span>
              <StatusChip status={output.researchCoverage[key]} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Existing solutions found ({output.solutions.length})
        </p>
        {output.solutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No credible existing solution was found addressing this problem.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {output.solutions.map((s) => (
              <div key={s.localId} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <Badge variant="outline">{s.solutionType}</Badge>
                  <StatusChip status={s.deploymentStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.organization} · {s.country}
                </p>
                <p className="mt-2 text-sm leading-6">{s.problemAddressed.claim}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <DetailsSection title="Research queries">
        <GenericPhaseOutput value={output.queries} />
      </DetailsSection>
      <DetailsSection title={`Sources (${output.sources.length})`}>
        <GenericPhaseOutput value={output.sources} />
      </DetailsSection>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
