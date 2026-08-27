import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

import { VerdictBadge } from "@/components/investigations/verdict-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPhaseDefinition } from "@/lib/prism/phases";
import { MODE_LABELS } from "@/lib/prism/modes";
import { listInvestigations } from "@/lib/services/investigations";
import { createUntypedClient } from "@/lib/supabase/server";

const SESSION_STATUS_LABELS: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

export default async function InvestigationsPage() {
  const supabase = await createUntypedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const result = await listInvestigations(supabase, user.id);
  const investigations = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investigations</h1>
          <p className="text-sm text-muted-foreground">
            Every problem you&apos;ve brought to PRISM, its current phase, and its verdict.
          </p>
        </div>
        <Button variant="prism" asChild>
          <Link href="/investigations/new">
            <Plus />
            New investigation
          </Link>
        </Button>
      </div>

      {investigations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">You haven&apos;t started an investigation yet.</p>
            <Button variant="prism" asChild>
              <Link href="/investigations/new">
                Start your first investigation
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {investigations.map((inv) => (
            <li key={inv.sessionId}>
              <Link href={`/investigations/${inv.sessionId}`} className="block">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold tracking-tight">
                          {inv.projectName}
                        </h2>
                        <Badge variant="outline">{MODE_LABELS[inv.mode]}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {inv.problemPreview}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {SESSION_STATUS_LABELS[inv.sessionStatus] ?? inv.sessionStatus} — currently on{" "}
                        {getPhaseDefinition(inv.currentPhaseKey).title}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <VerdictBadge decision={inv.latestVerdict} />
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
