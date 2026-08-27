"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  getIntroSeenServerSnapshot,
  getIntroSeenSnapshot,
  markIntroSeen,
  subscribeIntroSeen,
} from "@/lib/intro-store";

const LINES = [
  { text: "Welcome to PRISM.", duration: 2200 },
  { text: "You brought me a problem.", duration: 2400 },
  {
    text: "Before your team spends hours building a solution, let's find out whether the problem actually deserves one.",
    duration: 4200,
  },
  {
    text: "I'll investigate it from ten different angles — from the people affected, to what already exists, what's missing, whether it can be built, and whether it survives serious scrutiny.",
    duration: 5200,
  },
  { text: "Let's begin.", duration: 2000 },
] as const;

const FOOTER_DURATION = 2400;

export function IntroExperience() {
  const introSeen = React.useSyncExternalStore(
    subscribeIntroSeen,
    getIntroSeenSnapshot,
    getIntroSeenServerSnapshot,
  );
  const [dismissed, setDismissed] = React.useState(false);
  const [lineIndex, setLineIndex] = React.useState(0);
  const shouldReduceMotion = useReducedMotion();

  const visible = !introSeen && !dismissed;
  const showFooter = lineIndex >= LINES.length;

  const finish = React.useCallback(() => {
    setDismissed(true);
    markIntroSeen();
  }, []);

  React.useEffect(() => {
    if (!visible) return;

    if (showFooter) {
      const timer = setTimeout(finish, FOOTER_DURATION);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(
      () => setLineIndex((i) => i + 1),
      shouldReduceMotion ? 900 : LINES[lineIndex].duration,
    );
    return () => clearTimeout(timer);
  }, [visible, lineIndex, showFooter, finish, shouldReduceMotion]);

  if (!visible) return null;

  const current = lineIndex < LINES.length ? LINES[lineIndex] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PRISM introduction"
      className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background px-6 text-center"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={finish}
        className="absolute top-6 right-6 text-muted-foreground"
      >
        Skip intro
      </Button>

      <AnimatePresence mode="wait">
        {current ? (
          <motion.p
            key={lineIndex}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl text-2xl font-medium tracking-tight text-balance sm:text-3xl"
          >
            {current.text}
          </motion.p>
        ) : (
          <motion.p
            key="footer"
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-sm font-medium tracking-[0.3em] text-muted-foreground uppercase"
          >
            A product by Zero Degree
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
