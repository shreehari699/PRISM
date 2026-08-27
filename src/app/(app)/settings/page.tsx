import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceMuteToggle } from "@/components/voice/voice-mute-toggle";
import { VoicePreferencesForm } from "@/components/voice/voice-preferences-form";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account and PRISM preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Switch between PRISM&apos;s dark and light themes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice consultant</CardTitle>
          <CardDescription>
            PRISM narrates key moments of an investigation aloud using your browser&apos;s built-in
            speech synthesis. Nothing is sent to a third-party voice service.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Voice narration</span>
            <VoiceMuteToggle />
          </div>
          <VoicePreferencesForm />
        </CardContent>
      </Card>
    </div>
  );
}
