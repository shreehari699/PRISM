-- Atomic usage increment. Read-modify-write from application code would
-- race under concurrent requests from the same user; this does the
-- upsert-and-increment in a single statement instead. SECURITY DEFINER
-- because normal authenticated users have no INSERT/UPDATE grant on
-- usage_tracking (see 0007) — only the service role, or this function,
-- may write to it. The function still requires an explicit user_id
-- argument rather than trusting a client-supplied identity implicitly;
-- callers (src/lib/usage) always invoke it with the service role after
-- the request has already been authenticated.

create or replace function public.increment_usage(
  p_user_id uuid,
  p_period_type text,
  p_period_key text,
  p_ai_requests integer default 0,
  p_research_requests integer default 0,
  p_tokens integer default 0
)
returns public.usage_tracking
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.usage_tracking;
begin
  insert into public.usage_tracking (
    user_id, period_type, period_key, ai_requests, research_requests, tokens_used
  )
  values (
    p_user_id, p_period_type, p_period_key, p_ai_requests, p_research_requests, p_tokens
  )
  on conflict (user_id, period_type, period_key) do update
    set ai_requests = usage_tracking.ai_requests + excluded.ai_requests,
        research_requests = usage_tracking.research_requests + excluded.research_requests,
        tokens_used = usage_tracking.tokens_used + excluded.tokens_used
  returning * into result;

  return result;
end;
$$;

revoke all on function public.increment_usage from public;
grant execute on function public.increment_usage to service_role;
