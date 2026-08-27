// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserSpeechProvider } from "./browser-speech-provider";

class FakeUtterance {
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

describe("BrowserSpeechProvider.speak", () => {
  const originalUtterance = (globalThis as { SpeechSynthesisUtterance?: unknown })
    .SpeechSynthesisUtterance;

  afterEach(() => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
      originalUtterance;
    Reflect.deleteProperty(window, "speechSynthesis");
  });

  it("resolves rather than rejects when the browser throws synchronously from speechSynthesis.speak — narration must never turn into an unhandled promise rejection", async () => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
      FakeUtterance;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: () => {
          throw new DOMException("synthesis-failed");
        },
        cancel: vi.fn(),
      },
    });

    const provider = new BrowserSpeechProvider();
    await expect(provider.speak("hello")).resolves.toBeUndefined();
  });

  it("resolves normally once the utterance finishes", async () => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
      FakeUtterance;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: (utterance: FakeUtterance) => {
          queueMicrotask(() => utterance.onend?.());
        },
        cancel: vi.fn(),
      },
    });

    const provider = new BrowserSpeechProvider();
    await expect(provider.speak("hello")).resolves.toBeUndefined();
  });

  it("resolves (never rejects) when the utterance itself reports an error", async () => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
      FakeUtterance;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: (utterance: FakeUtterance) => {
          queueMicrotask(() => utterance.onerror?.());
        },
        cancel: vi.fn(),
      },
    });

    const provider = new BrowserSpeechProvider();
    await expect(provider.speak("hello")).resolves.toBeUndefined();
  });
});
