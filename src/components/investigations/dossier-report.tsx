import * as React from "react";

import { DetailsSection } from "@/components/investigations/details-section";
import { FinalVerdict } from "@/components/investigations/final-verdict";
import { GenericPhaseOutput } from "@/components/investigations/generic-phase-output";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { IntelligenceDossierAnalysis } from "@/lib/phases/intelligence-dossier/schema";
import { verdictDialogue } from "@/lib/voice/dialogue";
import { useVoiceConsultant } from "@/lib/voice/voice-context";

const EXECUTIVE_QUESTIONS: { key: keyof IntelligenceDossierAnalysis["executiveSummary"]; question: string }[] = [
  { key: "whatIsTheProblem", question: "What is the problem?" },
  { key: "whoHasTheProblem", question: "Who has the problem?" },
  { key: "whyDoesItMatter", question: "Why does it matter?" },
  { key: "whatAlreadyExists", question: "What already exists?" },
  { key: "whatIsMissing", question: "What is missing?" },
  { key: "whatOpportunityExists", question: "What opportunity exists?" },
  { key: "canItBeBuilt", question: "Can it be built?" },
  { key: "whatShouldBeBuilt", question: "What should be built?" },
  { key: "whatIsTheBiggestRisk", question: "What is the biggest risk?" },
  { key: "whatShouldTheTeamDoNext", question: "What should the team do next?" },
];

const DECISION_TRACE_LABELS: Record<keyof IntelligenceDossierAnalysis["decisionTrace"], string> = {
  problem: "Problem",
  pain: "Pain",
  gap: "Gap",
  opportunity: "Opportunity",
  market: "Market",
  feasibility: "Feasibility",
  solution: "Solution",
  validation: "Validation",
};

const IMPORTANCE_VARIANT: Record<string, "destructive" | "assumption" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "assumption",
  MEDIUM: "outline",
  LOW: "outline",
};

/**
 * The PRISM Intelligence Dossier — Phase 10's final synthesis of Phases
 * 01-09. The 20-section manifest, executive summary, decision trace, and
 * final verdict get bespoke treatment since they're the report's
 * navigational and decision-making spine; every underlying brief
 * (problem/stakeholder/pain/market/feasibility/etc.) is real, already-
 * validated data from earlier phases, rendered through the same
 * schema-agnostic viewer used elsewhere rather than re-authored here.
 */
export function DossierReport({ dossier }: { dossier: IntelligenceDossierAnalysis }) {
  const { speak } = useVoiceConsultant();
  const spoken = React.useRef(false);

  React.useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;
    const v = dossier.finalVerdict;
    speak(verdictDialogue(v.decision, v.confidence, v.reason));
    // Fires once when the dossier is first shown — `speak` is a stable
    // identity from voice context, not a dependency to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <FinalVerdict verdict={dossier.finalVerdict} />

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Executive summary</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EXECUTIVE_QUESTIONS.map(({ key, question }) => (
            <Card key={key}>
              <CardContent className="flex flex-col gap-1.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {question}
                </p>
                <p className="text-sm leading-6">{dossier.executiveSummary[key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">
          Decision trace ({Object.keys(dossier.decisionTrace).length} stages)
        </h3>
        <ol className="flex flex-col gap-2">
          {(Object.keys(DECISION_TRACE_LABELS) as (keyof IntelligenceDossierAnalysis["decisionTrace"])[]).map(
            (key, i) => {
              const stage = dossier.decisionTrace[key];
              return (
                <li key={key} className="flex gap-3 rounded-md border border-border p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{DECISION_TRACE_LABELS[key]}</p>
                      <Badge variant="outline">{stage.confidence}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{stage.finding}</p>
                  </div>
                </li>
              );
            },
          )}
        </ol>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Evidence summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(dossier.evidenceSummary).map(([key, value]) => (
            <div key={key} className="rounded-md border border-border p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Overall confidence: <Badge variant="outline">{dossier.overallConfidence}</Badge>
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">
          Report sections ({dossier.sectionManifest.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {dossier.sectionManifest.map((section) => (
            <li
              key={section.sectionId}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{section.title}</p>
                <p className="truncate text-xs text-muted-foreground">{section.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{section.status}</Badge>
                <Badge variant={IMPORTANCE_VARIANT[section.importance] ?? "outline"}>
                  {section.importance}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <DetailsSection title="Problem brief">
        <GenericPhaseOutput value={dossier.problemBrief} />
      </DetailsSection>
      <DetailsSection title="Stakeholders">
        <GenericPhaseOutput value={dossier.stakeholderBrief} />
      </DetailsSection>
      <DetailsSection title="Pain">
        <GenericPhaseOutput value={dossier.painBrief} />
      </DetailsSection>
      <DetailsSection title="Solution landscape">
        <GenericPhaseOutput value={dossier.solutionLandscape} />
      </DetailsSection>
      <DetailsSection title="Gaps">
        <GenericPhaseOutput value={dossier.gapBrief} />
      </DetailsSection>
      <DetailsSection title="Opportunity">
        <GenericPhaseOutput value={dossier.opportunityBrief} />
      </DetailsSection>
      <DetailsSection title="Market">
        <GenericPhaseOutput value={dossier.marketBrief} />
      </DetailsSection>
      <DetailsSection title="Feasibility">
        <GenericPhaseOutput value={dossier.feasibilityBrief} />
      </DetailsSection>
      <DetailsSection title="Recommended solution" defaultOpen>
        <GenericPhaseOutput value={dossier.recommendedSolution} />
      </DetailsSection>
      <DetailsSection title="Proof-of-concept plan">
        <GenericPhaseOutput value={dossier.pocPlan} />
      </DetailsSection>
      <DetailsSection title="Implementation plan">
        <GenericPhaseOutput value={dossier.implementationPlan} />
      </DetailsSection>
      <DetailsSection title="Red team summary">
        <GenericPhaseOutput value={dossier.redTeamSummary} />
      </DetailsSection>
      <DetailsSection title="Jury summary">
        <GenericPhaseOutput value={dossier.jurySummary} />
      </DetailsSection>
      <DetailsSection title="Assumptions">
        <GenericPhaseOutput value={dossier.assumptionSummary} />
      </DetailsSection>
      <DetailsSection title="Validation plan">
        <GenericPhaseOutput value={dossier.validationPlan} />
      </DetailsSection>
      <DetailsSection title="Next action plan" defaultOpen>
        <GenericPhaseOutput value={dossier.nextActionPlan} />
      </DetailsSection>

      <p className="rounded-lg border border-prism/20 bg-prism/5 p-4 text-sm leading-6 italic">
        &ldquo;{dossier.finalConsultantMessage}&rdquo;
      </p>
    </div>
  );
}
