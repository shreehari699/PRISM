-- Fixes a real gap between SECURITY.md's documented model ("profiles" is
-- user-writable: create/read/update rows the signed-in user owns) and what
-- 0007_row_level_security.sql actually implemented: it only ever added
-- SELECT and UPDATE policies for `profiles`, never INSERT. Profile rows were
-- expected to always exist via `handle_new_user()` (0002_profiles.sql)
-- firing on every new `auth.users` insert — which is correct for accounts
-- created *after* that trigger existed, but does nothing for any
-- `auth.users` row that predates it (e.g. an account created while testing,
-- before migrations were ever applied to this project). Those users have no
-- `profiles` row, so `projects.user_id references public.profiles (id)`
-- fails with a foreign key violation the moment they try to create a
-- project — the trigger cannot retroactively backfill rows that already
-- existed when it was created.
--
-- This migration does two things, matching the documented model exactly
-- rather than inventing a new one:
--   1. Adds the missing `profiles_insert_own` policy, so the application can
--      defensively self-heal a missing profile via the user's own
--      session (see `ensureOwnProfile` in src/lib/services/investigations.ts)
--      without ever needing the service-role client for this.
--   2. Backfills a `profiles` row for every existing `auth.users` row that
--      doesn't already have one, fixing any account already stuck in this
--      state today. Safe to re-run — `where p.id is null` makes it a no-op
--      for users who already have a profile.

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

insert into public.profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
