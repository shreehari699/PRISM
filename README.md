# PRISM

**Problem Research & Intelligence Strategy Matrix**
*A Zero Degree product.*

> Don't build the first solution. Understand the problem first.

PRISM is an agentic problem-intelligence and virtual consulting platform.
Before a team invests time building a solution, PRISM investigates the
problem itself: who is affected, how severe the pain really is, who
already tried to solve it, what gap remains, whether the opportunity is
technically and commercially real — and it is willing to conclude that a
problem is already well served, or that the evidence isn't there yet.

This repository is the source of truth for the production product.

## Status

This is the **architectural foundation**. It establishes the stack,
database schema, AI/research provider abstractions, and orchestration
scaffolding that the ten PRISM investigation phases will be built on top
of next. It intentionally does **not** yet implement the phase-by-phase
agent prompts, the investigation UI flow, voice, or the cinematic intro —
see `ARCHITECTURE.md` for what exists today versus what's planned.

## Stack

- **Framework:** Next.js (App Router), TypeScript (strict)
- **UI:** Tailwind CSS, hand-authored shadcn/ui-style components, Framer Motion, Lucide, React Three Fiber (installed, not yet wired)
- **Database:** Supabase (Postgres, Row Level Security, `@supabase/ssr`)
- **AI:** Google Gemini via `@google/genai`, model id configurable via `GEMINI_MODEL`
- **Research:** modular `ResearchProvider` abstraction (Tavily implemented; others pluggable)
- **Validation:** Zod everywhere AI output or user input crosses a trust boundary
- **Testing:** Vitest

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values — see ENVIRONMENT.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Check
`GET /api/health` for whether required configuration is present.

### Database

Apply the migrations in `supabase/migrations/` to a Supabase project —
see `supabase/README.md`. Every table has Row Level Security enabled;
`SECURITY.md` explains the policy design.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, database schema, AI orchestration, research layer
- [`SECURITY.md`](./SECURITY.md) — RLS design, secret handling, input/output validation
- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — every environment variable, what it does, where to get it
- [`supabase/README.md`](./supabase/README.md) — migration contents and how to apply them

## Free-tier first

PRISM is designed to run on free-tier Supabase and Gemini quotas. When a
configured usage limit is reached, the app enters a safe mode — it never
silently falls through to paid usage. See `src/lib/usage` and
`ENVIRONMENT.md`.
