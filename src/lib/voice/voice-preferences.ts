"use client";

/**
 * Voice tuning the user controls from Settings — rate, volume, and a
 * preferred browser voice. Mirrors `mute-store.ts`'s external-store
 * pattern (localStorage-backed, read via `useSyncExternalStore`) rather
 * than a second, parallel state mechanism.
 */
export interface VoicePreferences {
  rate: number;
  volume: number;
  voiceURI: string | null;
}

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  rate: 0.98,
  volume: 1,
  voiceURI: null,
};

const STORAGE_KEY = "prism-voice-preferences";
const listeners = new Set<() => void>();
let cached: VoicePreferences | null = null;

function readFromStorage(): VoicePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_VOICE_PREFERENCES;
    const p = parsed as Partial<VoicePreferences>;
    return {
      rate: typeof p.rate === "number" ? p.rate : DEFAULT_VOICE_PREFERENCES.rate,
      volume: typeof p.volume === "number" ? p.volume : DEFAULT_VOICE_PREFERENCES.volume,
      voiceURI: typeof p.voiceURI === "string" ? p.voiceURI : null,
    };
  } catch {
    return DEFAULT_VOICE_PREFERENCES;
  }
}

export function subscribeVoicePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVoicePreferencesSnapshot(): VoicePreferences {
  if (!cached) cached = readFromStorage();
  return cached;
}

export function getVoicePreferencesServerSnapshot(): VoicePreferences {
  return DEFAULT_VOICE_PREFERENCES;
}

export function setVoicePreferences(next: Partial<VoicePreferences>): void {
  cached = { ...getVoicePreferencesSnapshot(), ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore — the in-memory snapshot still updates for this session.
  }
  for (const listener of listeners) listener();
}
