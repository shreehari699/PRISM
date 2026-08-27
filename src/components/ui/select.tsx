import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A plain, styled native `<select>` rather than a Radix Select — native
 * selects already give correct keyboard navigation, screen-reader
 * semantics, and mobile picker UI for free, and PRISM's mode/priority
 * pickers never need custom option rendering that would justify the
 * extra dependency.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          // `bg-background`/`text-foreground` (not `bg-transparent`) are load-bearing here,
          // not cosmetic: the native option popup is drawn by the OS/browser, not this
          // component's own box, and it derives its colors from the <select>'s *resolved*
          // background/text color. A transparent background gives the browser nothing to
          // shade the popup with, so it falls back to a light system default — which,
          // combined with the light `text-foreground` this page uses in dark mode, renders
          // every option as pale text on a pale background. Explicit, non-transparent colors
          // here (plus the `color-scheme` already set on <html>) are what keep the open
          // dropdown legible in dark mode.
          "h-10 w-full appearance-none rounded-md border border-input bg-background px-3.5 py-2 pr-9 text-sm text-foreground shadow-xs transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "[&>option]:bg-background [&>option]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
