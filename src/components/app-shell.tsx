"use client";

import { FileSearch, History, LayoutGrid, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { VoiceMuteToggle } from "@/components/voice/voice-mute-toggle";
import { cn } from "@/lib/utils";

// "Investigations" and "History" both point at the same list — PRISM's
// investigation history *is* the investigations list (problem title,
// mode, created date, latest verdict, status), not two separate
// features, so this deliberately doesn't duplicate that page.
const NAV_ITEMS = [
  { href: "/investigations", label: "Investigations", icon: LayoutGrid },
  { href: "/investigations/new", label: "New Investigation", icon: Plus },
  { href: "/investigations", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  email,
  onSignOut,
  children,
}: {
  email: string;
  onSignOut: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:rounded-md focus:bg-prism focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-prism-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/investigations"
              className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase"
            >
              <FileSearch className="size-4 text-prism" aria-hidden="true" />
              PRISM
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/investigations" && pathname.startsWith(item.href)) ||
                  (item.href === "/investigations" &&
                    pathname.startsWith("/investigations") &&
                    pathname !== "/investigations/new" &&
                    !pathname.match(/^\/investigations\/[^/]+$/));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <VoiceMuteToggle />
            <ThemeToggle />
            <span className="hidden pl-2 text-sm text-muted-foreground lg:inline">{email}</span>
            <form action={onSignOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen ? (
          <nav aria-label="Primary" className="border-t border-border md:hidden">
            <ul className="flex flex-col gap-1 p-3">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
