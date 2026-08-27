import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HeroReveal } from "@/components/hero-reveal";
import { PhaseLayers } from "@/components/phase-layers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startHref = user ? "/investigations/new" : "/login?next=/investigations/new";

  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-5xl flex-col items-start gap-8 px-6 pt-28 pb-24 sm:pt-36">
        <HeroReveal>
          <Badge variant="outline" className="text-muted-foreground">
            A Zero Degree Product
          </Badge>
        </HeroReveal>

        <HeroReveal delay={0.06}>
          <h1 className="text-6xl leading-none font-semibold tracking-tighter sm:text-8xl">
            PRISM
          </h1>
        </HeroReveal>

        <HeroReveal delay={0.14}>
          <p className="text-sm font-medium tracking-[0.35em] text-prism uppercase sm:text-base">
            Think deeper. Build better.
          </p>
        </HeroReveal>

        <HeroReveal delay={0.22}>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Turn a problem statement into an evidence-backed build decision.
          </p>
        </HeroReveal>

        <HeroReveal delay={0.3}>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button size="lg" variant="prism" asChild>
              <Link href={startHref}>
                Start an Investigation
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href="#how-it-works">How PRISM Works</Link>
            </Button>
          </div>
        </HeroReveal>
      </section>

      <Separator />

      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-20 scroll-mt-16">
        <HeroReveal>
          <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            The Investigation
          </h2>
        </HeroReveal>
        <HeroReveal delay={0.06}>
          <p className="mt-3 max-w-2xl text-2xl font-medium tracking-tight">
            Ten layers of evidence, refracted from a single problem statement
            into a build decision.
          </p>
        </HeroReveal>

        <div className="mt-12">
          <PhaseLayers />
        </div>
      </section>

      <Separator />

      <footer className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        PRISM — Problem Research &amp; Intelligence Strategy Matrix. A Zero
        Degree product.
      </footer>
    </main>
  );
}
