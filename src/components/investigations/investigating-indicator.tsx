"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import * as React from "react";

const MESSAGES = [
  "Reading the evidence…",
  "Weighing the sources…",
  "Cross-checking the claims…",
  "Composing the findings…",
] as const;

/**
 * Live-run filler copy — deliberately generic and never a fake progress
 * percentage, since the actual work happens in one request/response
 * round trip with no intermediate state to report honestly.
 */
export function InvestigatingIndicator({ label }: { label: string }) {
  const [index, setIndex] = React.useState(0);
  const shouldReduceMotion = useReducedMotion();

  React.useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-prism" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          {MESSAGES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
