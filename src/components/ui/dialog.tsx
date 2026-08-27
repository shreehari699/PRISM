"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A thin wrapper around the native `<dialog>` element rather than a
 * Radix Dialog: `showModal()` already gives correct focus trapping,
 * Escape-to-close, and inert-background semantics for free, with no
 * extra dependency. Framer Motion is intentionally not used here —
 * animating the native top-layer/::backdrop reliably needs plain CSS
 * transitions, which `globals.css`'s `::backdrop` rule + this
 * component's own transition classes provide instead.
 */
function Dialog({
  open,
  onOpenChange,
  children,
  className,
  labelledBy,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
} & Omit<React.ComponentProps<"dialog">, "open" | "className">) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        "m-auto max-h-[85vh] w-full max-w-lg rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60",
        "open:animate-in open:fade-in open:zoom-in-95 open:duration-200",
        className,
      )}
      {...props}
    >
      {open ? children : null}
    </dialog>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-start justify-between gap-4 border-b border-border p-5", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DialogCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close dialog"
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <X className="size-4" />
    </button>
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("max-h-[60vh] overflow-y-auto p-5", className)}
      {...props}
    />
  );
}

export { Dialog, DialogHeader, DialogTitle, DialogCloseButton, DialogBody };
