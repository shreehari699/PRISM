import { ShieldQuestion } from "lucide-react";

import { NewInvestigationForm } from "@/components/investigations/new-investigation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewInvestigationPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">New investigation</h1>
        <p className="text-muted-foreground">
          PRISM investigates your problem across ten phases before recommending whether — and
          how — to build a solution.
        </p>
      </div>

      <Card className="border-prism/20 bg-prism/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldQuestion className="size-4 text-prism" aria-hidden="true" />
            Before you start
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          PRISM will not jump to a solution. It first investigates the people affected, the
          existing solutions, the gaps, the market, and whether the idea can realistically be
          built — and it will tell you honestly if the problem is already well served or the
          evidence doesn&apos;t support building yet. Each phase pauses for your review before the
          investigation moves on.
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <NewInvestigationForm />
        </CardContent>
      </Card>
    </div>
  );
}
