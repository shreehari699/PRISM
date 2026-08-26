-- Projects: the top-level container for one problem investigation.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  mode text not null check (
    mode in ('HACKATHON', 'PBL', 'STARTUP', 'RESEARCH', 'ZERO_DEGREE')
  ),
  status text not null default 'active' check (
    status in ('active', 'archived')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Problem statements: the raw input a project investigates. A project
-- can accumulate more than one over time (e.g. a refined restatement),
-- but exactly one is "active" per analysis session.

create table public.problem_statements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  raw_text text not null,
  input_method text not null check (
    input_method in ('paste', 'pdf_upload', 'idea', 'discovery')
  ),
  source_file_url text,
  discovery_parameters jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index problem_statements_project_id_idx
  on public.problem_statements (project_id);

create trigger problem_statements_set_updated_at
  before update on public.problem_statements
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.problem_statements enable row level security;
