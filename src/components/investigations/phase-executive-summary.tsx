import type { ReactNode } from "react";

/**
 * The "Level 1" read for a phase result — a 10-20 second summary above
 * the detailed evidence below. Every value passed in is real, already
 * computed from that phase's own output; this component only lays it
 * out, it never invents a headline, a count, or a confidence label.
 */
export function PhaseExecutiveSummary({
  headline,
  stats,
  confidence,
  uncertainty,
}: {
  /** The single strongest, most important real finding from this phase's own output. */
  headline: string;
  /** Real counts/facts worth surfacing at a glance, e.g. { label: "Pain points", value: 3 }. */
  stats?: { label: string; value: string | number }[];
  /** This phase's own real confidence/score readout — omit if the phase has none. */
  confidence?: ReactNode;
  /** The most important open question or gap in the evidence, if one exists. */
  uncertainty?: string;
}) {
  return (
    <div className="rounded-lg border border-prism/20 bg-prism/5 p-4">
      <p className="text-xs font-semibold tracking-wide text-prism uppercase">Executive intelligence</p>
      <p className="mt-1.5 text-sm leading-6 font-medium">{headline}</p>

      {stats && stats.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {stats.map((s) => (
            <span key={s.label}>
              {s.label}: <strong className="font-semibold text-foreground">{s.value}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {confidence ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">{confidence}</div> : null}

      {uncertainty ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Major uncertainty:</span> {uncertainty}
        </p>
      ) : null}
    </div>
  );
}
