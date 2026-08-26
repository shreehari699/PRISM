-- Row Level Security policies.
--
-- Design principle: a user may directly create/edit the records that
-- represent their own *input* (profile, projects, problem statements,
-- session navigation, voice transcripts). Every record that represents
-- *AI-generated or research-derived output* (analysis_phases and
-- everything phase-derived: stakeholders, pain_points, research_sources,
-- existing_solutions, gaps, opportunities, innovations, market/investment/
-- feasibility analysis, recommended_solutions, validation_results,
-- reports) is readable by its owner but writable only by the service
-- role — application server code re-validates project ownership before
-- writing with the admin client. This stops a malicious client from
-- fabricating a fake "VERIFIED" claim directly through the API and
-- keeps the honesty guarantees of the evidence system meaningful.
--
-- usage_tracking is readable by its owner and writable only by the
-- service role, so a user cannot reset or falsify their own quota.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create policy "projects_select_own" on public.projects
  for select using (user_id = auth.uid());

create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());

create policy "projects_update_own" on public.projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "projects_delete_own" on public.projects
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- problem_statements
-- ---------------------------------------------------------------------------
create policy "problem_statements_select_own" on public.problem_statements
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = problem_statements.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "problem_statements_insert_own" on public.problem_statements
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = problem_statements.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "problem_statements_update_own" on public.problem_statements
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = problem_statements.project_id
        and projects.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects
      where projects.id = problem_statements.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- analysis_sessions — user-managed navigation state
-- ---------------------------------------------------------------------------
create policy "analysis_sessions_select_own" on public.analysis_sessions
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = analysis_sessions.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "analysis_sessions_insert_own" on public.analysis_sessions
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = analysis_sessions.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "analysis_sessions_update_own" on public.analysis_sessions
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = analysis_sessions.project_id
        and projects.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects
      where projects.id = analysis_sessions.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- analysis_phases and analysis_phase_history — read-only to the owner,
-- written only by the service role.
-- ---------------------------------------------------------------------------
create policy "analysis_phases_select_own" on public.analysis_phases
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = analysis_phases.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "analysis_phase_history_select_own"
  on public.analysis_phase_history
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = analysis_phase_history.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Phase-derived output tables — read-only to the owner via project_id.
-- ---------------------------------------------------------------------------
do $$
declare
  derived_table text;
  derived_tables text[] := array[
    'stakeholders',
    'pain_points',
    'research_sources',
    'existing_solutions',
    'solution_comparisons',
    'gaps',
    'opportunities',
    'innovations',
    'market_analysis',
    'investment_analysis',
    'feasibility_analysis',
    'recommended_solutions',
    'validation_results',
    'reports'
  ];
begin
  foreach derived_table in array derived_tables loop
    execute format(
      'create policy %I on public.%I for select using (
         exists (
           select 1 from public.projects
           where projects.id = %I.project_id
             and projects.user_id = auth.uid()
         )
       );',
      derived_table || '_select_own',
      derived_table,
      derived_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- voice_sessions — low-stakes telemetry the client may write directly,
-- still gated on the caller owning both the row and the project.
-- ---------------------------------------------------------------------------
create policy "voice_sessions_select_own" on public.voice_sessions
  for select using (user_id = auth.uid());

create policy "voice_sessions_insert_own" on public.voice_sessions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = voice_sessions.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "voice_sessions_update_own" on public.voice_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- usage_tracking — read-only to the owner; only the service role writes,
-- so a user cannot reset or falsify their own free-tier quota.
-- ---------------------------------------------------------------------------
create policy "usage_tracking_select_own" on public.usage_tracking
  for select using (user_id = auth.uid());
