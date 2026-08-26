-- Phase-derived data tables. Each carries project_id directly (denormalized
-- from its phase/session) purely so RLS policies and indexes stay a single
-- join deep instead of chaining through analysis_phases -> analysis_sessions
-- -> projects on every query.

create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  name text not null,
  stakeholder_type text,
  description text not null,
  influence_level text check (influence_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index stakeholders_project_id_idx on public.stakeholders (project_id);
create index stakeholders_phase_id_idx on public.stakeholders (phase_id);

create table public.pain_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  stakeholder_id uuid references public.stakeholders (id) on delete set null,
  description text not null,
  severity_score integer check (severity_score between 0 and 100),
  frequency text,
  evidence_status text not null check (
    evidence_status in (
      'VERIFIED', 'INFERENCE', 'ASSUMPTION', 'RECOMMENDATION', 'UNKNOWN'
    )
  ),
  created_at timestamptz not null default now()
);

create index pain_points_project_id_idx on public.pain_points (project_id);
create index pain_points_stakeholder_id_idx on public.pain_points (stakeholder_id);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid references public.analysis_phases (id) on delete set null,
  title text not null,
  url text not null,
  publisher text,
  source_type text not null check (
    source_type in (
      'academic', 'government', 'industry', 'startup', 'commercial',
      'international', 'open_source', 'technology', 'market'
    )
  ),
  published_date date,
  retrieved_at timestamptz not null default now(),
  snippet text not null,
  evidence text,
  relevance numeric check (relevance between 0 and 1),
  confidence numeric check (confidence between 0 and 1),
  provider text not null,
  created_at timestamptz not null default now()
);

create index research_sources_project_id_idx on public.research_sources (project_id);
create index research_sources_phase_id_idx on public.research_sources (phase_id);

create table public.existing_solutions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  source_id uuid references public.research_sources (id) on delete set null,
  name text not null,
  description text not null,
  provider_name text,
  url text,
  strengths jsonb,
  weaknesses jsonb,
  evidence_status text not null check (
    evidence_status in (
      'VERIFIED', 'INFERENCE', 'ASSUMPTION', 'RECOMMENDATION', 'UNKNOWN'
    )
  ),
  created_at timestamptz not null default now()
);

create index existing_solutions_project_id_idx on public.existing_solutions (project_id);

create table public.solution_comparisons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  existing_solution_id uuid not null
    references public.existing_solutions (id) on delete cascade,
  dimension text not null,
  comparison_notes text not null,
  created_at timestamptz not null default now()
);

create index solution_comparisons_project_id_idx
  on public.solution_comparisons (project_id);
create index solution_comparisons_existing_solution_id_idx
  on public.solution_comparisons (existing_solution_id);

create table public.gaps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  related_pain_point_id uuid references public.pain_points (id) on delete set null,
  description text not null,
  severity_score integer check (severity_score between 0 and 100),
  evidence_status text not null check (
    evidence_status in (
      'VERIFIED', 'INFERENCE', 'ASSUMPTION', 'RECOMMENDATION', 'UNKNOWN'
    )
  ),
  created_at timestamptz not null default now()
);

create index gaps_project_id_idx on public.gaps (project_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  gap_id uuid references public.gaps (id) on delete set null,
  title text not null,
  description text not null,
  opportunity_score jsonb,
  created_at timestamptz not null default now()
);

create index opportunities_project_id_idx on public.opportunities (project_id);

create table public.innovations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  title text not null,
  description text not null,
  differentiation text,
  innovation_score jsonb,
  is_recommended boolean not null default false,
  created_at timestamptz not null default now()
);

create index innovations_project_id_idx on public.innovations (project_id);

create table public.market_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  target_segment text,
  market_size_notes text,
  competitive_landscape jsonb,
  evidence_status text not null check (
    evidence_status in (
      'VERIFIED', 'INFERENCE', 'ASSUMPTION', 'RECOMMENDATION', 'UNKNOWN'
    )
  ),
  created_at timestamptz not null default now()
);

create index market_analysis_project_id_idx on public.market_analysis (project_id);

create table public.investment_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  funding_considerations text,
  cost_estimate_notes text,
  evidence_status text not null check (
    evidence_status in (
      'VERIFIED', 'INFERENCE', 'ASSUMPTION', 'RECOMMENDATION', 'UNKNOWN'
    )
  ),
  created_at timestamptz not null default now()
);

create index investment_analysis_project_id_idx
  on public.investment_analysis (project_id);

create table public.feasibility_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  technical_notes text,
  feasibility_score jsonb,
  risks jsonb,
  constraints jsonb,
  created_at timestamptz not null default now()
);

create index feasibility_analysis_project_id_idx
  on public.feasibility_analysis (project_id);

create table public.recommended_solutions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  innovation_id uuid references public.innovations (id) on delete set null,
  title text not null,
  architecture_summary text not null,
  roadmap jsonb,
  created_at timestamptz not null default now()
);

create index recommended_solutions_project_id_idx
  on public.recommended_solutions (project_id);

create table public.validation_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid not null references public.analysis_phases (id) on delete cascade,
  poc_plan text,
  validation_criteria jsonb,
  actual_results text,
  status text not null default 'planned' check (
    status in ('planned', 'in_progress', 'validated', 'invalidated', 'inconclusive')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index validation_results_project_id_idx
  on public.validation_results (project_id);

create trigger validation_results_set_updated_at
  before update on public.validation_results
  for each row execute function public.set_updated_at();

alter table public.stakeholders enable row level security;
alter table public.pain_points enable row level security;
alter table public.research_sources enable row level security;
alter table public.existing_solutions enable row level security;
alter table public.solution_comparisons enable row level security;
alter table public.gaps enable row level security;
alter table public.opportunities enable row level security;
alter table public.innovations enable row level security;
alter table public.market_analysis enable row level security;
alter table public.investment_analysis enable row level security;
alter table public.feasibility_analysis enable row level security;
alter table public.recommended_solutions enable row level security;
alter table public.validation_results enable row level security;
