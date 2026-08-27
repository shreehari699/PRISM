"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * The last-resort error boundary for anything not caught closer to where
 * it happened (a phase action failure, a form submission error) — those
 * already render their own inline Alert. This only fires for genuinely
 * unexpected render/runtime errors, and deliberately never shows the raw
 * error message or stack trace to the user.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Unhandled PRISM UI error");
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        PRISM hit an unexpected error rendering this page. Your investigation data is safe — try
        again, or head back to your investigations.
      </p>
      <div className="flex gap-3">
        <Button variant="prism" onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/investigations">Back to investigations</Link>
        </Button>
      </div>
    </div>
  );
}
