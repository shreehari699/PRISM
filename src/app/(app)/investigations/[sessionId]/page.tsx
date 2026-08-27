import { notFound } from "next/navigation";

import { InvestigationDashboard } from "@/components/investigations/investigation-dashboard";
import { getSessionOverview } from "@/lib/services/investigations";
import { createUntypedClient } from "@/lib/supabase/server";

export default async function InvestigationSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createUntypedClient();

  const result = await getSessionOverview(supabase, sessionId);
  if (!result.ok) {
    notFound();
  }

  const { project, problemStatement, session, phases } = result.data;

  return (
    <InvestigationDashboard
      sessionId={sessionId}
      project={project}
      problemStatement={problemStatement}
      session={session}
      initialPhases={phases}
    />
  );
}
