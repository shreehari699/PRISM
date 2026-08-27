"use client";

import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoiceConsultant } from "@/lib/voice/voice-context";

export function VoiceMuteToggle() {
  const { muted, toggleMuted, supported } = useVoiceConsultant();

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleMuted}
      aria-pressed={!muted}
      aria-label={muted ? "Turn on the PRISM voice consultant" : "Mute the PRISM voice consultant"}
      title={muted ? "Voice consultant is off" : "Voice consultant is on"}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </Button>
  );
}
