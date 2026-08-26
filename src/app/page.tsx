import { ArrowRight, CircleDot } from "lucide-react";

import { HeroReveal } from "@/components/hero-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PRISM_PHASES } from "@/lib/prism/phases";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-5xl flex-col items-start gap-8 px-6 pt-28 pb-20 sm:pt-36">
        <HeroReveal>
          <Badge variant="outline" className="text-muted-foreground">
            A Zero Degree Product
          </Badge>
        </HeroReveal>

        <HeroReveal delay={0.08}>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Don&apos;t build the first solution.
            <br />
            <span className="text-prism">Understand the problem first.</span>
          </h1>
        </HeroReveal>

        <HeroReveal delay={0.16}>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            PRISM is an agentic problem-intelligence platform. Before a single
            line of a solution gets built, it investigates the people, the
            pain, the existing solutions, the gaps, the opportunity, and the
            feasibility — and it is willing to tell you the problem is
            already well served.
          </p>
        </HeroReveal>

        <HeroReveal delay={0.24}>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button size="lg" variant="prism" disabled>
              Start a Problem Investigation
              <ArrowRight />
            </Button>
            <p className="text-sm text-muted-foreground">
              The investigation workflow ships in the next milestone.
            </p>
          </div>
        </HeroReveal>
      </section>

      <Separator />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <HeroReveal>
          <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            The Investigation
          </h2>
        </HeroReveal>
        <HeroReveal delay={0.06}>
          <p className="mt-3 max-w-2xl text-2xl font-medium tracking-tight">
            Problem → Evidence → Stakeholders → Pain → Existing Solutions →
            Gaps → Opportunity → Innovation → Feasibility → Solution →
            Validation → Decision.
          </p>
        </HeroReveal>

        <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {PRISM_PHASES.map((phase) => (
            <li
              key={phase.key}
              className="flex flex-col gap-2 bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CircleDot className="size-3.5 text-prism" />
                Phase {String(phase.order).padStart(2, "0")}
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                {phase.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {phase.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Separator />

      <footer className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        PRISM — Problem Research &amp; Intelligence Strategy Matrix. A Zero
        Degree product.
      </footer>
    </main>
  );
}
