import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold tracking-tight">Not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page, or the investigation it points to, doesn&apos;t exist — or you don&apos;t have
        access to it.
      </p>
      <Button variant="prism" asChild>
        <Link href="/investigations">Back to investigations</Link>
      </Button>
    </div>
  );
}
