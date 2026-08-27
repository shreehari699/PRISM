import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A dependency-free, keyboard- and screen-reader-native expand/collapse section built on `<details>`. */
export function DetailsSection({
  title,
  trailing,
  children,
  defaultOpen = false,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-border [&_summary::-webkit-details-marker]:hidden"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          {title}
        </span>
        {trailing}
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
