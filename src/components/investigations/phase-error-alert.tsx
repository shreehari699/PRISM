import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { humanizePhaseError } from "@/lib/prism/error-messages";

/**
 * A phase failure's raw message (e.g. `Opportunity "OPP-001" has a claim
 * citing unknown source "GAP-001".`) is real, correct, and worth
 * preserving — but it isn't written for the person looking at it. This
 * leads with a human headline/explanation and keeps the raw text
 * available, never discarded, behind a "Technical details" disclosure.
 */
export function PhaseErrorAlert({ message }: { message: string | null | undefined }) {
  const { headline, detail, raw } = humanizePhaseError(message);

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <div className="flex-1">
        <AlertTitle>{headline}</AlertTitle>
        <AlertDescription>
          <p>{detail}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{raw}</pre>
          </details>
        </AlertDescription>
      </div>
    </Alert>
  );
}
