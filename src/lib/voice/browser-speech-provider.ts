import type { VoiceProvider } from "./types";

/**
 * The free baseline voice provider: the browser's own
 * `SpeechSynthesis` API. No network call, no API key, works offline.
 * Prefers an English voice if one is installed, but degrades to
 * whatever default voice the browser offers rather than failing.
 */
export class BrowserSpeechProvider implements VoiceProvider {
  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(
    text: string,
    options?: { rate?: number; pitch?: number; volume?: number; voiceURI?: string | null },
  ): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      // Narration is a pure enhancement — nothing about an investigation
      // depends on it — so any failure here resolves rather than rejects.
      // Some browsers throw synchronously (e.g. `speak()` on a
      // `speechSynthesis` left in a bad state after rapid cancellation),
      // which without this guard would reject this promise and, since
      // callers intentionally never await narration, surface as an
      // unhandled promise rejection in the console.
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options?.rate ?? 0.98;
        utterance.pitch = options?.pitch ?? 1;
        utterance.volume = options?.volume ?? 1;

        const voices = window.speechSynthesis.getVoices();
        const chosen =
          (options?.voiceURI ? voices.find((v) => v.voiceURI === options.voiceURI) : undefined) ??
          voices.find((v) => v.lang.startsWith("en") && v.localService);
        if (chosen) utterance.voice = chosen;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
