"use client";

import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";

const MODE_HINTS: Record<ProjectMode, string> = {
  HACKATHON: "Time-boxed build. PRISM weighs demo feasibility and judge impact.",
  PBL: "Coursework / capstone. PRISM structures around objectives, methodology, and results.",
  STARTUP: "Weighs market size, business model, and unit economics.",
  RESEARCH: "Weighs research question, literature, and methodological rigor.",
  ZERO_DEGREE: "Weighs strategic fit and long-term product potential for Zero Degree.",
};

const MODES = Object.keys(MODE_LABELS) as ProjectMode[];

export function NewInvestigationForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<ProjectMode>("STARTUP");
  const [problemStatement, setProblemStatement] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [timeline, setTimeline] = React.useState("");
  const [context, setContext] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const trimmedStatement = problemStatement.trim();
  const tooShort = trimmedStatement.length > 0 && trimmedStatement.length < 20;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (trimmedStatement.length < 20) {
      setError("Describe the problem in at least 20 characters so PRISM has something to investigate.");
      return;
    }

    setPending(true);

    const extra = [
      team.trim() ? `Team: ${team.trim()}` : null,
      timeline.trim() ? `Timeline: ${timeline.trim()}` : null,
      context.trim() ? `Additional context: ${context.trim()}` : null,
    ].filter((line): line is string => Boolean(line));

    const rawText = extra.length > 0 ? `${trimmedStatement}\n\n---\n${extra.join("\n")}` : trimmedStatement;

    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || trimmedStatement.slice(0, 60),
          mode,
          rawText,
          inputMethod: "paste",
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not start the investigation. Please try again.");
        setPending(false);
        return;
      }

      const data = (await response.json()) as { sessionId: string };
      router.push(`/investigations/${data.sessionId}`);
    } catch {
      setError("A network error stopped the investigation from starting. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="problemStatement">Problem statement</Label>
        <Textarea
          id="problemStatement"
          name="problemStatement"
          required
          rows={6}
          placeholder="Describe the problem you want PRISM to investigate — who has it, when it shows up, and why it matters. The more specific, the better the investigation."
          value={problemStatement}
          onChange={(e) => setProblemStatement(e.target.value)}
          aria-invalid={tooShort}
          aria-describedby="problemStatement-hint"
        />
        <p id="problemStatement-hint" className="text-xs text-muted-foreground">
          {trimmedStatement.length} characters — minimum 20.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Investigation name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Optional — PRISM will title it from your problem statement"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mode">Project mode</Label>
          <Select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as ProjectMode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{MODE_HINTS[mode]}</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="team">Team (optional)</Label>
          <Input
            id="team"
            name="team"
            placeholder="e.g. 2 engineers, 1 designer"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="timeline">Timeline (optional)</Label>
          <Input
            id="timeline"
            name="timeline"
            placeholder="e.g. 6-week hackathon, 3-month MVP"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="context">Additional context (optional)</Label>
        <Textarea
          id="context"
          name="context"
          rows={3}
          placeholder="Constraints, prior attempts, existing assets — anything else PRISM should weigh."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <div>
        <Button type="submit" variant="prism" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Analyze with PRISM
          {!pending ? <ArrowRight /> : null}
        </Button>
      </div>
    </form>
  );
}
