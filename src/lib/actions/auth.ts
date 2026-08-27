"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Signs the current user out via the existing Supabase Auth session cookie, then redirects home. Never a second auth system. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
