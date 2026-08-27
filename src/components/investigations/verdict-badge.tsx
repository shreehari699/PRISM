import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

const DECISION_LABELS: Record<string, string> = {
  BUILD: "Build",
  BUILD_WITH_CHANGES: "Build with changes",
  VALIDATE_BEFORE_BUILD: "Validate before build",
  RESEARCH_BEFORE_BUILD: "Research further",
  DO_NOT_BUILD: "Do not build",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
};

const DECISION_VARIANTS: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  BUILD: "verified",
  BUILD_WITH_CHANGES: "recommendation",
  VALIDATE_BEFORE_BUILD: "inference",
  RESEARCH_BEFORE_BUILD: "inference",
  DO_NOT_BUILD: "destructive",
  INSUFFICIENT_EVIDENCE: "unknown",
};

/** Renders a Phase 10 final decision — or "In progress" when the dossier hasn't run yet. Never invents a verdict. */
export function VerdictBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <Badge variant="outline">In progress</Badge>;
  }

  return (
    <Badge variant={DECISION_VARIANTS[decision] ?? "outline"}>
      {DECISION_LABELS[decision] ?? decision}
    </Badge>
  );
}
