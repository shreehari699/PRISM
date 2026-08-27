/**
 * Provider-agnostic speech output. `BrowserSpeechProvider` (the free
 * baseline, using `window.speechSynthesis`) is the only implementation
 * today, but every call site goes through this interface — swapping in
 * a paid, higher-quality voice later (e.g. a server route that proxies
 * a TTS API and streams audio back) means writing one new class that
 * implements this interface, never touching the components that call
 * `speak`. No implementation may ever require an API key in the
 * browser: a server-backed provider must fetch its audio from a same
 * app server route, not call a third-party API directly from client code.
 */
export interface VoiceProvider {
  /** True if this provider can actually speak in the current environment (e.g. `speechSynthesis` exists). */
  isSupported(): boolean;
  /** Speaks `text`. Resolves once speech finishes (or immediately if unsupported/interrupted). */
  speak(text: string, options?: { rate?: number; pitch?: number }): Promise<void>;
  /** Stops any speech in progress. */
  cancel(): void;
}

/**
 * The seven dialogue "moments" PRISM's voice layer can generate for.
 * Every moment's copy is built dynamically from real phase data — see
 * `src/lib/voice/dialogue.ts` — never one hard-coded line reused across
 * every investigation.
 */
export type VoiceMoment =
  | "welcome"
  | "phase_transition"
  | "discovery"
  | "warning"
  | "research"
  | "red_team"
  | "verdict";
