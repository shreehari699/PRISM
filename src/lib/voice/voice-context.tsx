"use client";

import * as React from "react";

import {
  getMutedServerSnapshot,
  getMutedSnapshot,
  getSpeechSupportServerSnapshot,
  getSpeechSupportSnapshot,
  setMuted as persistMuted,
  subscribeMuted,
  subscribeSpeechSupport,
} from "./mute-store";
import { getVoiceProvider } from "./provider";

interface VoiceConsultantContextValue {
  muted: boolean;
  toggleMuted: () => void;
  supported: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

const VoiceConsultantContext = React.createContext<VoiceConsultantContextValue | null>(null);

export function VoiceConsultantProvider({ children }: { children: React.ReactNode }) {
  const muted = React.useSyncExternalStore(subscribeMuted, getMutedSnapshot, getMutedServerSnapshot);
  const supported = React.useSyncExternalStore(
    subscribeSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const provider = React.useMemo(() => getVoiceProvider(), []);

  const toggleMuted = React.useCallback(() => {
    const next = !muted;
    if (next) provider.cancel();
    persistMuted(next);
  }, [muted, provider]);

  const speak = React.useCallback(
    (text: string) => {
      if (muted || !supported) return;
      void provider.speak(text);
    },
    [muted, supported, provider],
  );

  const stop = React.useCallback(() => provider.cancel(), [provider]);

  const value = React.useMemo(
    () => ({ muted, toggleMuted, supported, speak, stop }),
    [muted, toggleMuted, supported, speak, stop],
  );

  return (
    <VoiceConsultantContext.Provider value={value}>{children}</VoiceConsultantContext.Provider>
  );
}

/** Access the PRISM voice consultant from any client component. Speaking is a no-op while muted or unsupported. */
export function useVoiceConsultant() {
  const ctx = React.useContext(VoiceConsultantContext);
  if (!ctx) {
    throw new Error("useVoiceConsultant must be used inside <VoiceConsultantProvider>");
  }
  return ctx;
}
