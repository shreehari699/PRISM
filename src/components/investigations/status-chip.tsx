import type { VariantProps } from "class-variance-authority";

import { Badge, type badgeVariants } from "@/components/ui/badge";

const EXACT_BAD = ["HIGH", "NO"];
const SUBSTRING_BAD = [
  "INFEASIBLE",
  "NOT_FEASIBLE",
  "HIGH_RISK",
  "UNAVAILABLE",
  "RESTRICTED",
  "DO_NOT_BUILD",
];

const EXACT_WARNING = ["MEDIUM"];
const SUBSTRING_WARNING = [
  "DIFFICULT",
  "CONDITIONALLY",
  "PARTIAL",
  "REQUIRES_CUSTOM_RESEARCH",
  "REQUIRES_BUILD",
];

const EXACT_GOOD = ["LOW", "YES"];
const SUBSTRING_GOOD = ["FEASIBLE", "AVAILABLE", "READY"];

const UNKNOWN_WORDS = ["UNKNOWN", "INSUFFICIENT"];

type Variant = VariantProps<typeof badgeVariants>["variant"];

/**
 * A generic status-word -> color heuristic shared across the many
 * different feasibility/risk/scalability enums (FEASIBLE/INFEASIBLE,
 * AVAILABLE/UNAVAILABLE, LOW/MEDIUM/HIGH risk, and more) rather than
 * hand-mapping each of the dozen distinct enum types PRISM's agents use.
 * Exact-word checks run before substring checks so a compound value like
 * "HIGHLY_FEASIBLE" (good) isn't misread via the standalone bad word
 * "HIGH", and bad/warning checks run before good so a compound value
 * like "UNAVAILABLE" or "CONDITIONALLY_FEASIBLE" isn't misread via the
 * good substring it happens to contain ("AVAILABLE", "FEASIBLE").
 */
export function statusVariant(status: string): Variant {
  const upper = status.toUpperCase();
  if (UNKNOWN_WORDS.some((w) => upper.includes(w))) return "unknown";
  if (EXACT_BAD.includes(upper) || SUBSTRING_BAD.some((w) => upper.includes(w))) return "destructive";
  if (EXACT_WARNING.includes(upper) || SUBSTRING_WARNING.some((w) => upper.includes(w))) {
    return "assumption";
  }
  if (EXACT_GOOD.includes(upper) || SUBSTRING_GOOD.some((w) => upper.includes(w))) return "verified";
  return "outline";
}

export function StatusChip({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)} className="uppercase">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
