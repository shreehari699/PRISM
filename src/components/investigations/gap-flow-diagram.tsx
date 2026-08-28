import { EvidenceClaimCard } from "@/components/investigations/evidence-claim";
import { StatusChip } from "@/components/investigations/status-chip";
import { Badge } from "@/components/ui/badge";
import type { CoverageMatrixEntry, GapCandidate } from "@/lib/agents/gap-agent/schema";

const GAP_STATE_LABELS: Record<GapCandidate["gapState"], string> = {
  CONFIRMED_GAP: "Confirmed gap",
  CANDIDATE_GAP: "Candidate gap",
  UNVERIFIED_GAP: "Unverified gap",
  NO_GAP_ESTABLISHED: "No gap — already covered",
};

/** ✓ fully covered, ~ partially covered, ? not established/unknown — never invented, always a real `coverageStatusSchema` value. */
const COVERAGE_SYMBOL: Record<CoverageMatrixEntry["status"], string> = {
  COVERED: "✓",
  PARTIALLY_COVERED: "~",
  NOT_ESTABLISHED: "?",
  UNKNOWN: "?",
};

function GapCard({ gap, coverage }: { gap: GapCandidate; coverage: CoverageMatrixEntry[] }) {
  const relevantCoverage = coverage.filter((c) => gap.relatedExistingSolutions.includes(c.existingSolutionId));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{gap.gapId}</span>
            <h4 className="text-sm font-semibold tracking-tight">{gap.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{gap.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusChip status={gap.gapState} />
          <Badge variant="outline">{gap.confidence} confidence</Badge>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{GAP_STATE_LABELS[gap.gapState]}</span>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EvidenceClaimCard label="Missing capability" claim={gap.missingCapability} />
        <EvidenceClaimCard label="Why it matters" claim={gap.whyItMatters} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Capability coverage checked against existing solutions
        </p>
        {relevantCoverage.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {relevantCoverage.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold"
                  aria-hidden="true"
                >
                  {COVERAGE_SYMBOL[c.status]}
                </span>
                <span className="truncate">{c.capability}</span>
                <span className="text-xs text-muted-foreground">— {c.reasoning}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No coverage data cross-referenced.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          Compared against:{" "}
          {gap.relatedExistingSolutions.length > 0 ? (
            gap.relatedExistingSolutions.map((id) => (
              <Badge key={id} variant="outline" className="ml-1">
                {id}
              </Badge>
            ))
          ) : (
            <em>no directly comparable existing solution</em>
          )}
        </span>
      </div>

      {gap.evidenceClaims.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Evidence</p>
          <div className="flex flex-col gap-2">
            {gap.evidenceClaims.map((claim, i) => (
              <EvidenceClaimCard key={i} label={`Evidence ${i + 1}`} claim={claim} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Full-width intelligence cards for every real, non-rejected gap
 * candidate — one card per gap, nothing invented: every field is either
 * on the gap candidate itself or a cross-referenced coverage-matrix
 * entry.
 */
export function GapFlowDiagram({
  gaps,
  coverageMatrix,
}: {
  gaps: GapCandidate[];
  coverageMatrix: CoverageMatrixEntry[];
}) {
  const shown = gaps.filter((g) => g.gapState !== "NO_GAP_ESTABLISHED");

  if (shown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No confirmed, candidate, or unverified gaps — every evaluated candidate was already
        addressed by an existing solution.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {shown.map((gap) => (
        <GapCard key={gap.gapId} gap={gap} coverage={coverageMatrix} />
      ))}
    </div>
  );
}
