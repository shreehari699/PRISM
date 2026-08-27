import { BrowserSpeechProvider } from "./browser-speech-provider";
import type { VoiceProvider } from "./types";

let cached: VoiceProvider | undefined;

/**
 * The one place that decides which `VoiceProvider` implementation is
 * active. Today it always returns the browser baseline; swapping in a
 * higher-quality provider later means changing this function only —
 * every UI call site already speaks through the `VoiceProvider`
 * interface, not this concrete class.
 */
export function getVoiceProvider(): VoiceProvider {
  if (!cached) cached = new BrowserSpeechProvider();
  return cached;
}
