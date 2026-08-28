import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { PhaseExecutiveSummary } from "@/components/investigations/phase-executive-summary";
import { ScoreBar } from "@/components/investigations/score-bar";
import { StatusChip } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";

/** Phase 02: every stakeholder touched by the problem, and which of their pains is actually primary. */
export function StakeholderPainView({ output }: { output: StakeholderPainAnalysis }) {
  const primaryPainPoint = output.painPoints.find((p) => p.localId === output.primaryPain.painLocalId);
  const stakeholderByLocalId = new Map(output.stakeholders.map((s) => [s.localId, s]));

  return (
    <div className="flex flex-col gap-6">
      <PhaseExecutiveSummary
        headline={
          primaryPainPoint
            ? `Primary pain: ${primaryPainPoint.painTitle}`
            : "No primary pain point was established."
        }
        stats={[
          { label: "Stakeholders", value: output.stakeholders.length },
          { label: "Pain points", value: output.painPoints.length },
          { label: "Secondary pains", value: output.secondaryPains.length },
        ]}
        confidence={
          <>
            <StatusChip status={output.realityCheck.stakeholderConfidence} />
            <StatusChip status={output.realityCheck.painConfidence} />
            <StatusChip status={output.realityCheck.primaryPainConfidence} />
          </>
        }
        uncertainty={
          output.realityCheck.evidenceCompleteness !== "STRONG" ? output.realityCheck.summary : undefined
        }
      />

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Stakeholders ({output.stakeholders.length})
        </p>
        <div className="flex flex-col gap-2">
          {output.stakeholders.map((s) => (
            <div key={s.localId} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{s.name}</p>
                <Badge variant="outline">{s.category}</Badge>
                {s.roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.context}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.painPointIds.length} pain point(s) · {s.influence} influence · {s.decisionPower} decision
                power
              </p>
            </div>
          ))}
        </div>
      </div>

      {primaryPainPoint ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-medium tracking-wide text-destructive uppercase">Primary pain</p>
          <p className="mt-1 text-sm font-semibold">{primaryPainPoint.painTitle}</p>
          <p className="mt-1 text-sm leading-6">{primaryPainPoint.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Affects: {stakeholderByLocalId.get(primaryPainPoint.stakeholderLocalId)?.name ?? "Unknown"}
          </p>
          <p className="mt-2 text-sm italic text-muted-foreground">{output.primaryPain.reasoning}</p>
          <div className="mt-3">
            <ScoreBar label="Severity" score={primaryPainPoint.severityScore.overall} />
          </div>
        </div>
      ) : null}

      <DetailsSection title={`All pain points (${output.painPoints.length})`}>
        <GenericPhaseOutput value={output.painPoints} />
      </DetailsSection>

      {output.secondaryPains.length > 0 ? (
        <DetailsSection title={`Secondary pains (${output.secondaryPains.length})`}>
          <GenericPhaseOutput value={output.secondaryPains} />
        </DetailsSection>
      ) : null}

      <Alert>
        <AlertTitle>Reality check</AlertTitle>
        <AlertDescription>
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusChip status={output.realityCheck.stakeholderConfidence} />
            <StatusChip status={output.realityCheck.painConfidence} />
            <StatusChip status={output.realityCheck.primaryPainConfidence} />
          </div>
          {output.realityCheck.summary}
        </AlertDescription>
      </Alert>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
