"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <p className="text-sm font-medium tracking-widest text-destructive uppercase">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        PRISM hit an unexpected error.
      </h1>
      <p className="max-w-md text-muted-foreground">
        Nothing you were working on has been lost. You can try again, and if
        this keeps happening it&apos;s worth reporting.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
