import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-10 text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
      >
        PRISM
      </Link>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>

        {children}

        <p className="mt-8 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  );
}
