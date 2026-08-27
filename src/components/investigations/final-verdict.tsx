import { AlertTriangle } from "lucide-react";

import { VerdictBadge } from "@/components/investigations/verdict-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FinalVerdict as FinalVerdictType } from "@/lib/phases/intelligence-dossier/schema";

/** Phase 10's final verdict — always rendered from the real, composer-computed decision. Never hard-coded, never softened. */
export function FinalVerdict({ verdict }: { verdict: FinalVerdictType }) {
  return (
    <Card className="border-prism/30 bg-gradient-to-b from-prism/10 to-transparent">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge decision={verdict.decision} />
          <Badge variant="outline">{verdict.confidence} confidence</Badge>
          <Badge variant="outline">Evidence: {verdict.evidenceStrength}</Badge>
        </div>

        <p className="text-lg leading-8 font-medium">{verdict.reason}</p>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Major reasons
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {verdict.majorReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {verdict.criticalBlockers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {verdict.criticalBlockers.map((b, i) => (
              <Alert variant="destructive" key={i}>
                <AlertTriangle />
                <AlertTitle>{b.title}</AlertTitle>
                <AlertDescription>{b.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        <div className="rounded-md border border-prism/20 bg-background p-4">
          <p className="text-xs font-medium tracking-wide text-prism uppercase">Next action</p>
          <p className="mt-1 text-sm leading-6">{verdict.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
