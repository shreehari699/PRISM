import type { Score } from "@/lib/prism/scoring";

/** A 0-100 PRISM score, always shown with its basis and reasoning — never a bare number implying false precision. */
export function ScoreBar({ label, score }: { label: string; score: Score }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{score.value}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" role="presentation">
        <div className="h-full rounded-full bg-prism" style={{ width: `${score.value}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {score.basis === "ai_estimate" ? "AI estimate" : "Heuristic"} · {score.confidence} confidence
        {" — "}
        {score.reasoning}
      </p>
    </div>
  );
}
