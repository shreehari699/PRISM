import { EvidenceBadge } from "@/components/investigations/evidence-badge";

const EVIDENCE_LIKE = new Set([
  "VERIFIED",
  "INFERENCE",
  "ASSUMPTION",
  "RECOMMENDATION",
  "UNKNOWN",
  "MODEL_ESTIMATE",
]);

function titleCase(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A schema-agnostic renderer for phase `outputData`. Every PRISM phase
 * persists a different Zod shape, so rather than hand-write ten bespoke
 * viewers up front, this walks whatever structure actually came back and
 * renders it faithfully — real field names, real values, evidence-status
 * strings rendered as the same badges used everywhere else. Individual
 * phases can still get a bespoke, richer view later without this one
 * lying in the meantime.
 */
export function GenericPhaseOutput({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">No data.</p>;
  }

  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (EVIDENCE_LIKE.has(upper)) return <EvidenceBadge status={value} />;
    return <p className="text-sm leading-6 text-foreground">{value}</p>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-sm font-medium tabular-nums">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-sm text-muted-foreground">None.</p>;

    const allPrimitive = value.every((v) => typeof v !== "object" || v === null);
    if (allPrimitive) {
      return (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {value.map((v, i) => (
            <li key={i} className="text-sm leading-6">
              <GenericPhaseOutput value={v} depth={depth + 1} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {value.map((v, i) => (
          <div key={i} className="rounded-md border border-border p-3">
            <GenericPhaseOutput value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">None.</p>;

    return (
      <dl className="flex flex-col gap-3">
        {entries.map(([key, v]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {titleCase(key)}
            </dt>
            <dd>
              <GenericPhaseOutput value={v} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return null;
}
