"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Volume2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  getIntroSeenServerSnapshot,
  getIntroSeenSnapshot,
  markIntroSeen,
  subscribeIntroSeen,
} from "@/lib/intro-store";
import { useVoiceConsultant } from "@/lib/voice/voice-context";

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
  const [voiceStarted, setVoiceStarted] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { muted, toggleMuted, supported, speak, stop } = useVoiceConsultant();

  const visible = !introSeen && !dismissed;
  const showFooter = lineIndex >= LINES.length;

  const finish = React.useCallback(() => {
    stop();
    setDismissed(true);
    markIntroSeen();
  }, [stop]);

  // Browsers only allow SpeechSynthesis to actually produce audio once the
  // page has real user activation — a `speak()` call fired automatically on
  // mount would be silently dropped in most browsers. This button is that
  // required user gesture: it unmutes (if needed) and speaks the line
  // already on screen synchronously inside the click handler, and every
  // later line in this same intro then narrates too, since activation
  // persists for the rest of the page's lifetime once granted.
  function enableVoice() {
    if (muted) toggleMuted();
    setVoiceStarted(true);
    if (!showFooter) speak(LINES[lineIndex].text);
  }

  React.useEffect(() => {
    if (!visible) return;

    if (showFooter) {
      const timer = setTimeout(finish, FOOTER_DURATION);
      return () => clearTimeout(timer);
    }

    if (voiceStarted) speak(LINES[lineIndex].text);

    const timer = setTimeout(
      () => setLineIndex((i) => i + 1),
      shouldReduceMotion ? 900 : LINES[lineIndex].duration,
    );
    return () => clearTimeout(timer);
    // `speak` intentionally excluded: it's a stable identity from voice
    // context, not a value this effect should re-run for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lineIndex, showFooter, finish, shouldReduceMotion, voiceStarted]);

  if (!visible) return null;

  const current = lineIndex < LINES.length ? LINES[lineIndex] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PRISM introduction"
      className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {supported && !voiceStarted ? (
          <Button type="button" variant="outline" size="sm" onClick={enableVoice}>
            <Volume2 />
            Enter with voice
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
          Skip intro
        </Button>
      </div>

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
