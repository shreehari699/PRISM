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

  speak(text: string, options?: { rate?: number; pitch?: number }): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? 0.98;
      utterance.pitch = options?.pitch ?? 1;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith("en") && v.localService);
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
