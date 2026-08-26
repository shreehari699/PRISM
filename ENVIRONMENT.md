# Environment variables

Copy `.env.example` to `.env.local` for local development and fill in
real values. Never commit `.env.local`.

All variables are validated at startup by
`src/lib/config/env.schema.ts` — a missing or malformed required
variable fails fast with a specific message rather than an obscure
runtime error later.

## Public (safe for the browser)

These are inlined into the client bundle by Next.js at build time
because they're prefixed `NEXT_PUBLIC_`. Never put a secret behind this
prefix.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL, e.g. `https://xxxx.supabase.co`. Supabase dashboard → Project Settings → API. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | The publishable (anon) key. Same page as above. Safe to expose — Row Level Security is what actually restricts access, not secrecy of this key. |
| `NEXT_PUBLIC_APP_URL` | No | Base URL of this deployment, used for auth redirects. Defaults to `http://localhost:3000` in `.env.example`. |

## Server-only (never exposed to the browser)

Every module that reads these imports `server-only`, which fails the
build if pulled into client code.

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Bypasses Row Level Security entirely. Supabase dashboard → Project Settings → API → `service_role` secret. Used only in `src/lib/supabase/admin.ts`, and only after application code independently verifies the caller owns the resource being written. |
| `GEMINI_API_KEY` | Yes | Google AI Studio API key for Gemini. |
| `GEMINI_MODEL` | No (default `gemini-2.5-flash`) | The Gemini model id to use. Never hard-coded elsewhere in the app — change this if a model is deprecated or a better one becomes available. If the configured model is unavailable, `src/lib/ai/gemini-provider.ts` returns an explicit `unavailable` result instead of crashing. |
| `RESEARCH_PROVIDER` | No (default `none`) | One of `none`, `tavily`, `serpapi`, `bing`. `none` makes the research layer honestly report "unavailable" instead of fabricating sources. Only `tavily` is implemented today — `serpapi`/`bing` throw a clear "not implemented" error rather than silently degrading. |
| `TAVILY_API_KEY` | Only if `RESEARCH_PROVIDER=tavily` | [tavily.com](https://tavily.com) has a free tier suitable for initial deployment. |
| `SERPAPI_API_KEY` | Not yet used | Reserved for when the SerpApi provider is implemented. |
| `BING_SEARCH_API_KEY` | Not yet used | Reserved for when the Bing provider is implemented. |
| `USAGE_DAILY_AI_REQUEST_LIMIT` | No (default `50`) | Per-user daily cap on Gemini calls before safe mode engages. Tune to your actual Gemini free-tier quota. |
| `USAGE_MONTHLY_AI_REQUEST_LIMIT` | No (default `1000`) | Per-user monthly cap on Gemini calls. |
| `USAGE_DAILY_RESEARCH_REQUEST_LIMIT` | No (default `30`) | Per-user daily cap on research provider calls. Tune to your research provider's free-tier quota. |

## Free-tier notes

- **Supabase**: the free tier covers Postgres, Auth, and Row Level
  Security at the scale this app needs to start. No paid Supabase
  feature is required by anything in this repository.
- **Gemini**: Google AI Studio's free tier is rate-limited per model;
  set `USAGE_DAILY_AI_REQUEST_LIMIT` / `USAGE_MONTHLY_AI_REQUEST_LIMIT`
  to match whatever your actual quota is — PRISM doesn't know your quota
  on its own and won't guess a safe number for you.
- **Tavily**: has a free monthly credit allotment; set
  `USAGE_DAILY_RESEARCH_REQUEST_LIMIT` accordingly.
- None of this wiring creates automatic billing. Reaching a configured
  limit puts the affected user into safe mode (`src/lib/usage`) — their
  project is preserved and they're told capacity will return, rather
  than PRISM silently spending money on their behalf.

## Verifying your setup

```bash
npm run dev
curl http://localhost:3000/api/health
```

A `200` with `"status": "ok"` means every required server variable is
present. A `503` with `"status": "degraded"` lists which ones are
missing (never their values).
