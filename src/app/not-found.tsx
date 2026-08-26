import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        This page doesn&apos;t exist.
      </h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for was moved, renamed, or never
        existed.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to PRISM</Link>
      </Button>
    </main>
  );
}
