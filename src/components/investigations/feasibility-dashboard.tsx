import { AlertTriangle } from "lucide-react";
import type React from "react";

import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { MarketNumberDisplay } from "@/components/investigations/market-number";
import { PhaseExecutiveSummary } from "@/components/investigations/phase-executive-summary";
import { ScoreBar } from "@/components/investigations/score-bar";
import { StatusChip, statusVariant } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TechnicalFeasibilityAnalysis } from "@/lib/phases/technical-feasibility/schema";

/** The first status whose color reads as a concern (destructive, then warning, then unknown) — or the first status at all if every one reads fine. Never invents a rollup value; it only picks which real status to surface. */
function worstStatus(statuses: string[]): string | undefined {
  return (
    statuses.find((s) => statusVariant(s) === "destructive") ??
    statuses.find((s) => statusVariant(s) === "assumption") ??
    statuses.find((s) => statusVariant(s) === "unknown") ??
    statuses[0]
  );
}

function DimensionCard({
  title,
  status,
  meta,
  children,
}: {
  title: string;
  status?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <DetailsSection
      title={title}
      trailing={
        <div className="flex items-center gap-2">
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          {status ? <StatusChip status={status} /> : <Badge variant="outline">N/A</Badge>}
        </div>
      }
    >
      {children}
    </DetailsSection>
  );
}

/**
 * PRISM's 11-dimension feasibility view (Phase 07): technical, data, AI,
 * hardware, software, team, time, cost, regulatory, security, and
 * scalability — the same eleven top-level categories
 * `feasibilityAgentOutputSchema` actually persists. Critical blockers and
 * the overall verdict get top billing per the product spec; every
 * dimension's full real output is still reachable by expanding it.
 */
export function FeasibilityDashboard({ output }: { output: TechnicalFeasibilityAnalysis }) {
  const technicalStatuses = Object.values(output.technicalFeasibility).map((d) => d.status);
  const softwareStatuses = Object.values(output.softwareFeasibility).map((d) => d.status);
  const scalabilityLevels = Object.values(output.scalability).map((d) => d.level);
  const teamGaps = output.teamFeasibility.skills.filter(
    (s) => s.required && s.teamHasCapability !== "YES",
  );

  return (
    <div className="flex flex-col gap-6">
      <PhaseExecutiveSummary
        headline={output.overallFeasibility.explanation}
        stats={[
          { label: "Critical blockers", value: output.criticalBlockers.length },
          { label: "Team gaps", value: teamGaps.length },
        ]}
        confidence={<StatusChip status={output.overallFeasibility.status} />}
      />

      <Card
        className={
          output.overallFeasibility.status === "INFEASIBLE" ||
          output.overallFeasibility.status === "DIFFICULT"
            ? "border-destructive/30 bg-destructive/5"
            : "border-prism/20 bg-prism/5"
        }
      >
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Overall feasibility
            </span>
            <StatusChip status={output.overallFeasibility.status} />
          </div>
          <p className="text-sm leading-6">{output.overallFeasibility.explanation}</p>
        </CardContent>
      </Card>

      {output.criticalBlockers.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Critical blockers ({output.criticalBlockers.length})
          </h3>
          {output.criticalBlockers.map((blocker, i) => (
            <Alert variant="destructive" key={i}>
              <AlertTriangle />
              <AlertTitle>{blocker.title}</AlertTitle>
              <AlertDescription>
                {blocker.description}
                <span className="mt-1 block text-xs uppercase">{blocker.category}</span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : (
        <Alert>
          <AlertDescription>No critical blockers identified.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.entries(output.feasibilityScores).map(([key, score]) => (
          <ScoreBar key={key} label={key} score={score} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold tracking-tight">The eleven dimensions</h3>

        <DimensionCard title="Technical" status={worstStatus(technicalStatuses)}>
          <GenericPhaseOutput value={output.technicalFeasibility} />
        </DimensionCard>

        <DimensionCard
          title="Data"
          meta={`${output.dataFeasibility.requirements.length} requirement(s)`}
          status={worstStatus(output.dataFeasibility.requirements.map((r) => r.availability))}
        >
          <GenericPhaseOutput value={output.dataFeasibility} />
        </DimensionCard>

        <DimensionCard
          title="AI"
          status={output.aiFeasibility?.classification}
        >
          {output.aiFeasibility ? (
            <GenericPhaseOutput value={output.aiFeasibility} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This opportunity doesn&apos;t propose an AI component.
            </p>
          )}
        </DimensionCard>

        <DimensionCard title="Hardware" status={output.hardwareFeasibility ? undefined : undefined}>
          {output.hardwareFeasibility ? (
            <GenericPhaseOutput value={output.hardwareFeasibility} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This opportunity doesn&apos;t involve physical hardware.
            </p>
          )}
        </DimensionCard>

        <DimensionCard title="Software" status={worstStatus(softwareStatuses)}>
          <GenericPhaseOutput value={output.softwareFeasibility} />
        </DimensionCard>

        <DimensionCard
          title="Team"
          meta={teamGaps.length > 0 ? `${teamGaps.length} gap(s)` : "No gaps"}
          status={teamGaps.length > 0 ? "PARTIAL" : "AVAILABLE"}
        >
          <GenericPhaseOutput value={output.teamFeasibility} />
        </DimensionCard>

        <DimensionCard title="Time">
          <div className="flex flex-col gap-4">
            <MarketNumberDisplay label="Minimum viable build time" n={output.timeFeasibility.minimumViableBuildTime} />
            <MarketNumberDisplay label="Prototype time" n={output.timeFeasibility.prototypeTime} />
            <MarketNumberDisplay label="Production time" n={output.timeFeasibility.productionTime} />
          </div>
        </DimensionCard>

        <DimensionCard title="Cost">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.entries(output.costFeasibility).map(([key, n]) => (
              <MarketNumberDisplay key={key} label={key} n={n} />
            ))}
          </div>
        </DimensionCard>

        <DimensionCard
          title="Regulatory"
          meta={`${output.regulatorySafety.items.length} item(s)`}
        >
          <GenericPhaseOutput value={output.regulatorySafety} />
        </DimensionCard>

        <DimensionCard title="Security" status={output.securityPrivacy.securityRisk}>
          <GenericPhaseOutput value={output.securityPrivacy} />
        </DimensionCard>

        <DimensionCard title="Scalability" status={worstStatus(scalabilityLevels)}>
          <GenericPhaseOutput value={output.scalability} />
        </DimensionCard>
      </div>

      <DetailsSection title={`Risk register (${output.riskRegister.length})`}>
        <GenericPhaseOutput value={output.riskRegister} />
      </DetailsSection>

      <DetailsSection title="Build scope">
        <GenericPhaseOutput value={output.buildScope} />
      </DetailsSection>

      <DetailsSection title="Implementation roadmap" defaultOpen>
        <GenericPhaseOutput value={output.implementationRoadmap} />
      </DetailsSection>

      <Alert variant={output.feasibilityRealityCheck.signal === "NOT_FEASIBLE_NOW" ? "destructive" : "default"}>
        <AlertTitle>Reality check</AlertTitle>
        <AlertDescription>{output.feasibilityRealityCheck.explanation}</AlertDescription>
      </Alert>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
