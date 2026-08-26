-- Final dossier reports. `content` holds the fully-assembled report
-- sections; it is a snapshot generated from the project's validated
-- data, not a source of truth in its own right, so it can always be
-- regenerated deterministically from the phase tables above.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id uuid not null
    references public.analysis_sessions (id) on delete cascade,
  decision text check (
    decision in ('BUILD', 'RESEARCH_FURTHER', 'PARK', 'REJECT')
  ),
  decision_reasoning text,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index reports_project_id_idx on public.reports (project_id);

-- Voice consultant sessions. Transcript is stored as a jsonb array of
-- {role, text, phase_key, at} entries rather than raw audio — the voice
-- layer only ever speaks short contextual remarks, never full report
-- content, so transcripts stay small.

create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  transcript jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index voice_sessions_project_id_idx on public.voice_sessions (project_id);
create index voice_sessions_user_id_idx on public.voice_sessions (user_id);

-- Usage tracking for free-tier safety limits. One row per user per
-- (period_type, period_key), e.g. ('daily', '2026-08-26') or
-- ('monthly', '2026-08'). Application code increments this on every AI
-- or research call and consults it before making the next one — see
-- src/lib/usage.

create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_type text not null check (period_type in ('daily', 'monthly')),
  period_key text not null,
  ai_requests integer not null default 0,
  research_requests integer not null default 0,
  tokens_used integer not null default 0,
  safe_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, period_type, period_key)
);

create index usage_tracking_user_id_idx on public.usage_tracking (user_id);

create trigger usage_tracking_set_updated_at
  before update on public.usage_tracking
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.usage_tracking enable row level security;
