import { Flame, Gavel } from "lucide-react";
import * as React from "react";

import { DetailsSection } from "@/components/investigations/details-section";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { ScoreBar } from "@/components/investigations/score-bar";
import { StatusChip } from "@/components/investigations/status-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { JuryPanel, JuryPerspectiveReview } from "@/lib/agents/validation-agent/schema";
import type { PocValidationAnalysis } from "@/lib/phases/poc-validation/schema";
import { redTeamIntroDialogue } from "@/lib/voice/dialogue";
import { useVoiceConsultant } from "@/lib/voice/voice-context";

const JUDGE_LABELS: Record<keyof JuryPanel, string> = {
  technicalJudge: "Technical Judge",
  domainExpert: "Domain Expert",
  businessJudge: "Business Judge",
  impactJudge: "Impact Judge",
  productJudge: "Product Judge",
};

function JudgeCard({ label, review }: { label: string; review: JuryPerspectiveReview }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Gavel className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {label}
        </h4>
        <span className="text-xs text-muted-foreground">{review.confidence} confidence</span>
      </div>

      <ScoreBar label="Assessment" score={review.scoreOrAssessment} />

      <p className="rounded-md bg-accent/50 p-3 text-sm font-medium italic">
        &ldquo;{review.criticalQuestion}&rdquo;
      </p>

      {review.strengths.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Strengths</p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {review.concerns.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Concerns</p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {review.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-muted-foreground">{review.reasoning}</p>
    </div>
  );
}

/**
 * Phase 09's red team + jury review, with the distinct visual treatment
 * the spec asks for: a stark, unmistakably adversarial opening for the
 * red team section, then the five named judges. `finalValidationDecision`
 * (the composer's mechanically-derived verdict) is shown as the
 * authoritative outcome — the agent's own `buildRecommendation` is real
 * data too, but is never allowed to read as the final word.
 */
export function RedTeamJuryView({ output }: { output: PocValidationAnalysis }) {
  const fragileAssumption = output.assumptionRegister.find(
    (a) => a.assumptionId === output.redTeamReview.mostFragileAssumptionId,
  );
  const { speak } = useVoiceConsultant();
  const spoken = React.useRef(false);

  React.useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;
    speak(redTeamIntroDialogue());
    // Fires once when this phase's review is first shown — `speak` is a
    // stable identity from voice context, not a dependency to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <Flame className="size-5" aria-hidden="true" />
          Enough being nice.
        </h3>
        <p className="mt-1 text-sm text-destructive/90">
          Every assumption gets attacked here — before a real judge does.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {output.redTeamReview.points.map((point) => (
            <div key={point.pointId} className="rounded-md border border-destructive/20 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={point.category === "EVIDENCE_BACKED" ? "verified" : "unknown"}>
                  {point.category === "EVIDENCE_BACKED" ? "Evidence-backed" : "Hypothetical"}
                </Badge>
                <span className="text-xs text-muted-foreground">{point.targetArea}</span>
                <StatusChip status={point.severity} />
              </div>
              <p className="mt-2 text-sm leading-6">{point.argument}</p>
            </div>
          ))}
        </div>

        {fragileAssumption ? (
          <div className="mt-4 rounded-md border border-destructive/20 bg-background p-3">
            <p className="text-xs font-medium text-destructive uppercase">Most fragile assumption</p>
            <p className="mt-1 text-sm">{fragileAssumption.assumption}</p>
          </div>
        ) : null}

        {output.redTeamReview.hiddenDependencies.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-destructive uppercase">Hidden dependencies</p>
            <ul className="mt-1 list-disc pl-4 text-sm">
              {output.redTeamReview.hiddenDependencies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-destructive/90">{output.redTeamReview.summary}</p>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold tracking-tight">The jury</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(Object.keys(JUDGE_LABELS) as (keyof JuryPanel)[]).map((key) => (
            <JudgeCard key={key} label={JUDGE_LABELS[key]} review={output.jury[key]} />
          ))}
        </div>
      </div>

      <DetailsSection title={`Jury questions (${output.juryQuestions.length})`} defaultOpen>
        <div className="flex flex-col gap-3">
          {output.juryQuestions.map((q) => (
            <div key={q.questionId} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{q.question}</p>
                <StatusChip status={q.answerStatus} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{q.bestAnswer}</p>
            </div>
          ))}
        </div>
      </DetailsSection>

      <Alert>
        <AlertTitle className="flex flex-wrap items-center gap-2">
          Final validation decision <StatusChip status={output.finalValidationDecision} />
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">
            {output.finalValidationDecisionReasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      <DetailsSection title="Assumption register">
        <GenericPhaseOutput value={output.assumptionRegister} />
      </DetailsSection>
      <DetailsSection title="Failure modes & pre-mortem">
        <GenericPhaseOutput value={{ failureModes: output.failureModes, preMortem: output.preMortem }} />
      </DetailsSection>
      <DetailsSection title="Counter-solution analysis">
        <GenericPhaseOutput value={output.counterSolutionAnalysis} />
      </DetailsSection>
      <DetailsSection title="Validation plan">
        <GenericPhaseOutput value={output.validationPlan} />
      </DetailsSection>
      <DetailsSection title="Validation scores">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(output.validationScores).map(([key, score]) => (
            <ScoreBar key={key} label={key} score={score} />
          ))}
        </div>
      </DetailsSection>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{output.consultantMessage}&rdquo;
      </p>
    </div>
  );
}
