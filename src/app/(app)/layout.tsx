import { redirect } from "next/navigation";
import type React from "react";

import { AppShell } from "@/components/app-shell";
import { IntroExperience } from "@/components/intro-experience";
import { signOutAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Every route under this group requires a real Supabase Auth session.
 * This redirect is a UX convenience only — the actual security boundary
 * is Row Level Security on every table these pages read, so a gap here
 * can never become an authorization bypass (see src/lib/supabase/middleware.ts).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell email={user.email ?? "Signed in"} onSignOut={signOutAction}>
      <IntroExperience />
      {children}
    </AppShell>
  );
}
