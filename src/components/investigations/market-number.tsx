import { EvidenceBadge } from "@/components/investigations/evidence-badge";
import type { MarketNumber } from "@/lib/prism/market";

function formatValue(n: MarketNumber): string {
  if (n.value === null) return "—";
  const formatted = n.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const currency = n.currency ? `${n.currency} ` : "";
  const unit = n.unit ? ` ${n.unit}` : "";
  return `${currency}${formatted}${unit}`;
}

/** Renders any `marketNumberSchema` value honestly: a real figure with its status, or an explicit UNKNOWN — never a bare number presented as fact. */
export function MarketNumberDisplay({ label, n }: { label: string; n: MarketNumber }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <EvidenceBadge status={n.status} />
      </div>
      <p className="text-lg font-semibold tabular-nums">{formatValue(n)}</p>
      <p className="text-xs leading-5 text-muted-foreground">{n.reasoning}</p>
      {n.calculation ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Show calculation</summary>
          <div className="mt-2 flex flex-col gap-1 pl-3">
            <p className="font-mono">{n.calculation.formula}</p>
            <ul className="list-disc pl-4">
              {n.calculation.inputs.map((input, i) => (
                <li key={i}>
                  {input.label}: {input.value} {input.unit}
                </li>
              ))}
            </ul>
            {n.calculation.assumptions.length > 0 ? (
              <p>Assumptions: {n.calculation.assumptions.join("; ")}</p>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
