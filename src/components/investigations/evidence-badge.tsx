import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

const KNOWN_STATUSES = ["VERIFIED", "INFERENCE", "ASSUMPTION", "RECOMMENDATION", "UNKNOWN"] as const;

type EvidenceVariant = Extract<
  VariantProps<typeof badgeVariants>["variant"],
  "verified" | "inference" | "assumption" | "recommendation" | "unknown"
>;

/** Maps PRISM's evidence-status vocabulary (VERIFIED/INFERENCE/ASSUMPTION/RECOMMENDATION/UNKNOWN, and MODEL_ESTIMATE as a market-number variant) onto the design system's evidence badge tokens. */
export function evidenceVariant(status: string): EvidenceVariant {
  const upper = status.toUpperCase();
  if ((KNOWN_STATUSES as readonly string[]).includes(upper)) {
    return upper.toLowerCase() as EvidenceVariant;
  }
  if (upper === "MODEL_ESTIMATE") return "inference";
  return "unknown";
}

export function EvidenceBadge({ status }: { status: string }) {
  return (
    <Badge variant={evidenceVariant(status)} className="uppercase">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
