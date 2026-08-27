import { EvidenceBadge } from "@/components/investigations/evidence-badge";
import type { EvidenceClaim } from "@/lib/prism/evidence";

/** A single `evidenceClaimSchema` value: the claim, its evidence status, and why. */
export function EvidenceClaimCard({ label, claim }: { label: string; claim: EvidenceClaim }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <EvidenceBadge status={claim.status} />
      </div>
      <p className="text-sm leading-6">{claim.claim}</p>
      <p className="text-xs text-muted-foreground">{claim.reasoning}</p>
    </div>
  );
}
