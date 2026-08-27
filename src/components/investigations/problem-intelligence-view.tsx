import { CheckCircle2, XCircle } from "lucide-react";

import { DetailsSection } from "@/components/investigations/details-section";
import { EvidenceClaimCard } from "@/components/investigations/evidence-claim";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { ScoreBar } from "@/components/investigations/score-bar";
import { Badge } from "@/components/ui/badge";
import type { ProblemAnatomy } from "@/lib/agents/problem-analyst/schema";

/** Phase 01: the problem's anatomy — who, what, where, when, why, restated and scored before anything else runs. */
export function ProblemIntelligenceView({ output }: { output: ProblemAnatomy }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-prism/20 bg-prism/5 p-4">
        <p className="text-sm leading-6">{output.restatement}</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {output.clarity.isWellDefined ? (
          <>
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Well-defined problem statement
          </>
        ) : (
          <>
            <XCircle className="size-4 text-warning" aria-hidden="true" />
            The problem statement has ambiguities
          </>
        )}
      </div>
      {output.clarity.issues.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {output.clarity.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Who is affected
        </p>
        <div className="flex flex-wrap gap-2">
          {output.who.map((w, i) => (
            <Badge key={i} variant="outline" title={w.description}>
              {w.group}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <EvidenceClaimCard label="What" claim={output.what} />
        <EvidenceClaimCard label="Where" claim={output.where} />
        <EvidenceClaimCard label="When" claim={output.when} />
      </div>

      <DetailsSection title={`Why it persists (${output.why.length})`} defaultOpen>
        <div className="flex flex-col gap-3">
          {output.why.map((claim, i) => (
            <EvidenceClaimCard key={i} label={`Root cause ${i + 1}`} claim={claim} />
          ))}
        </div>
      </DetailsSection>

      {output.assumptions.length > 0 ? (
        <DetailsSection title={`Assumptions (${output.assumptions.length})`}>
          <GenericPhaseOutput value={output.assumptions} />
        </DetailsSection>
      ) : null}

      {output.openQuestions.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Open questions for later phases
          </p>
          <ul className="list-disc pl-5 text-sm">
            {output.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ScoreBar label="Problem score" score={output.problemScore} />
    </div>
  );
}
