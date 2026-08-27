"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type React from "react";

import { EvidenceBadge } from "@/components/investigations/evidence-badge";
import { StatusChip } from "@/components/investigations/status-chip";
import { Badge } from "@/components/ui/badge";
import type { CoverageMatrixEntry, GapCandidate } from "@/lib/agents/gap-agent/schema";

const GAP_STATE_LABELS: Record<GapCandidate["gapState"], string> = {
  CONFIRMED_GAP: "Confirmed gap",
  CANDIDATE_GAP: "Candidate gap",
  UNVERIFIED_GAP: "Unverified gap",
  NO_GAP_ESTABLISHED: "No gap — already covered",
};

function Node({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <div
      className={
        emphasis
          ? "rounded-lg border border-destructive/40 bg-destructive/5 p-4"
          : "rounded-lg border border-border bg-card p-4"
      }
    >
      {children}
    </div>
  );
}

function GapFlow({ gap, coverage }: { gap: GapCandidate; coverage: CoverageMatrixEntry[] }) {
  const shouldReduceMotion = useReducedMotion();
  const relevant = coverage.filter((c) => gap.relatedExistingSolutions.includes(c.existingSolutionId));

  const steps = [
    <Node key="existing">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Existing solution(s)
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {gap.relatedExistingSolutions.length > 0 ? (
          gap.relatedExistingSolutions.map((id) => (
            <Badge key={id} variant="outline">
              {id}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">None considered directly comparable.</p>
        )}
      </div>
    </Node>,
    <Node key="capabilities">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Capabilities checked
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {relevant.length > 0 ? (
          relevant.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{c.capability}</span>
              <StatusChip status={c.status} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No coverage data cross-referenced.</p>
        )}
      </div>
    </Node>,
    <Node key="gap" emphasis>
      <p className="text-xs font-medium tracking-wide text-destructive uppercase">Gap</p>
      <p className="mt-2 text-sm leading-6">{gap.missingCapability.claim}</p>
      <div className="mt-2">
        <EvidenceBadge status={gap.missingCapability.status} />
      </div>
    </Node>,
    <Node key="need">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Unserved need
      </p>
      <p className="mt-2 text-sm leading-6">{gap.whyItMatters.claim}</p>
    </Node>,
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold tracking-tight">{gap.title}</h4>
        <StatusChip status={gap.gapState} />
        <span className="text-xs text-muted-foreground">{GAP_STATE_LABELS[gap.gapState]}</span>
      </div>
      <p className="text-sm text-muted-foreground">{gap.description}</p>
      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : i * 0.12 }}
            className="contents"
          >
            {step}
            {i < steps.length - 1 ? (
              <ArrowRight
                className="hidden size-4 shrink-0 self-center text-muted-foreground sm:block"
                aria-hidden="true"
              />
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Renders "Existing Solution -> Capabilities -> Covered Needs -> GAP -> Unserved Need" for every real, non-rejected gap candidate. Nothing here is invented — every node is a field already on the gap candidate or a cross-referenced coverage-matrix entry. */
export function GapFlowDiagram({
  gaps,
  coverageMatrix,
}: {
  gaps: GapCandidate[];
  coverageMatrix: CoverageMatrixEntry[];
}) {
  const shown = gaps.filter((g) => g.gapState !== "NO_GAP_ESTABLISHED");

  if (shown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No confirmed, candidate, or unverified gaps — every evaluated candidate was already
        addressed by an existing solution.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {shown.map((gap) => (
        <GapFlow key={gap.gapId} gap={gap} coverage={coverageMatrix} />
      ))}
    </div>
  );
}
