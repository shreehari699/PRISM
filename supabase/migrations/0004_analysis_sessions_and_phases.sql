-- Analysis sessions: one investigation run over a problem statement.
-- Kept separate from `projects` so a project can be re-investigated
-- (e.g. after a materially revised problem statement) without losing the
-- history of the earlier run.

create table public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  problem_statement_id uuid not null
    references public.problem_statements (id) on delete cascade,
  current_phase_key text not null default 'problem_intelligence' check (
    current_phase_key in (
      'problem_intelligence',
      'stakeholder_pain',
      'existing_solutions',
      'gap_intelligence',
      'opportunity_innovation',
      'market_investment',
      'technical_feasibility',
      'solution_consultant',
      'poc_validation',
      'intelligence_dossier'
    )
  ),
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'abandoned')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analysis_sessions_project_id_idx
  on public.analysis_sessions (project_id);

create trigger analysis_sessions_set_updated_at
  before update on public.analysis_sessions
  for each row execute function public.set_updated_at();

-- Analysis phases: one row per PRISM phase per session. `version`
-- increments every regeneration so the UI can show "this was
-- regenerated" without losing the ability to reconstruct prior output
-- (older versions stay in `superseded_output` history — see below).

create table public.analysis_phases (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.analysis_sessions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_key text not null check (
    phase_key in (
      'problem_intelligence',
      'stakeholder_pain',
      'existing_solutions',
      'gap_intelligence',
      'opportunity_innovation',
      'market_investment',
      'technical_feasibility',
      'solution_consultant',
      'poc_validation',
      'intelligence_dossier'
    )
  ),
  status text not null default 'not_started' check (
    status in (
      'not_started',
      'pending_input',
      'running',
      'awaiting_approval',
      'approved',
      'needs_regeneration',
      'failed'
    )
  ),
  version integer not null default 1,
  input_data jsonb,
  output_data jsonb,
  error_message text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, phase_key)
);

create index analysis_phases_session_id_idx
  on public.analysis_phases (session_id);
create index analysis_phases_project_id_idx
  on public.analysis_phases (project_id);

create trigger analysis_phases_set_updated_at
  before update on public.analysis_phases
  for each row execute function public.set_updated_at();

-- History of superseded phase output, written by application code
-- immediately before a regeneration overwrites analysis_phases.output_data.
-- Keeps "every phase must be reviewable" honest across regenerations
-- without bloating the hot-path table with an unbounded jsonb array.

create table public.analysis_phase_history (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null
    references public.analysis_phases (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version integer not null,
  output_data jsonb not null,
  superseded_at timestamptz not null default now(),
  superseded_reason text
);

create index analysis_phase_history_phase_id_idx
  on public.analysis_phase_history (phase_id);

alter table public.analysis_sessions enable row level security;
alter table public.analysis_phases enable row level security;
alter table public.analysis_phase_history enable row level security;
