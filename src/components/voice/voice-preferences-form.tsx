"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  getAvailableVoicesServerSnapshot,
  getAvailableVoicesSnapshot,
  subscribeAvailableVoices,
} from "@/lib/voice/available-voices";
import {
  getVoicePreferencesServerSnapshot,
  getVoicePreferencesSnapshot,
  setVoicePreferences,
  subscribeVoicePreferences,
} from "@/lib/voice/voice-preferences";

/** Rate/volume/voice controls for the browser Speech Synthesis voice consultant. Renders nothing if speech isn't supported. */
export function VoicePreferencesForm() {
  const preferences = React.useSyncExternalStore(
    subscribeVoicePreferences,
    getVoicePreferencesSnapshot,
    getVoicePreferencesServerSnapshot,
  );
  const voices = React.useSyncExternalStore(
    subscribeAvailableVoices,
    getAvailableVoicesSnapshot,
    getAvailableVoicesServerSnapshot,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="voice-rate">
          Speaking rate — {preferences.rate.toFixed(2)}×
        </Label>
        <input
          id="voice-rate"
          type="range"
          min={0.75}
          max={1.5}
          step={0.01}
          value={preferences.rate}
          onChange={(e) => setVoicePreferences({ rate: Number(e.target.value) })}
          className="accent-prism"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="voice-volume">
          Volume — {Math.round(preferences.volume * 100)}%
        </Label>
        <input
          id="voice-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={preferences.volume}
          onChange={(e) => setVoicePreferences({ volume: Number(e.target.value) })}
          className="accent-prism"
        />
      </div>

      {voices.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="voice-select">Voice</Label>
          <Select
            id="voice-select"
            value={preferences.voiceURI ?? ""}
            onChange={(e) => setVoicePreferences({ voiceURI: e.target.value || null })}
          >
            <option value="">Browser default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
