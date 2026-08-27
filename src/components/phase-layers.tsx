"use client";

import { motion, useReducedMotion } from "framer-motion";

import { PRISM_PHASES } from "@/lib/prism/phases";

/**
 * The "light splitting through a prism" visual: ten ordered layers,
 * revealed as a staggered cascade. Purely decorative/informational — it
 * renders the same static PRISM_PHASES catalog the rest of the app uses,
 * never invented copy.
 */
export function PhaseLayers() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <ol className="relative flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
      {PRISM_PHASES.map((phase, i) => (
        <motion.li
          key={phase.key}
          initial={shouldReduceMotion ? undefined : { opacity: 0, x: -16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="group flex items-center gap-4 bg-card px-5 py-4 transition-colors hover:bg-accent/50 sm:gap-6 sm:px-6"
        >
          <span
            aria-hidden="true"
            className="font-mono text-xs font-medium text-muted-foreground tabular-nums"
          >
            {String(phase.order).padStart(2, "0")}
          </span>
          <span
            aria-hidden="true"
            className="hidden h-8 w-px shrink-0 bg-gradient-to-b from-prism/10 via-prism to-prism/10 sm:block"
            style={{ opacity: 0.3 + (i / (PRISM_PHASES.length - 1)) * 0.7 }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold tracking-tight sm:text-base">{phase.title}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
              {phase.description}
            </p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
