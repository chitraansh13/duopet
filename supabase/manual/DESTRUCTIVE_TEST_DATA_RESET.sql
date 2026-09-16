-- ============================================================================
-- DESTRUCTIVE TEST-DATA RESET ONLY — NEVER RUN AGAINST REAL USER DATA
-- ============================================================================
-- Purpose: empty DuoPet application data before deleting disposable test users
-- from Supabase Authentication -> Users.
--
-- This file is intentionally outside supabase/migrations. It must be run
-- manually by a project owner in the Supabase SQL Editor. It does not delete
-- auth.users and does not alter schemas, tables, RLS, policies, functions,
-- triggers, indexes, extensions, or migration history.
--
-- TRUNCATE uses one explicit allowlist and deliberately omits CASCADE. If a
-- future migration adds a dependent table that is missing here, PostgreSQL
-- will fail and roll back instead of clearing an unexpected table.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

-- Listed leaf-to-root for auditability. A single TRUNCATE statement makes the
-- foreign-key graph atomic; table order within this statement is documentary.
truncate table
  public.challenge_result_members,
  public.challenge_results,
  public.pet_xp_events,
  public.goal_checkins,
  public.challenges,
  public.goal_assignments,
  public.goals,
  public.pet_room_items,
  public.pet_unlocks,
  public.duo_pets,
  public.duo_members,
  public.duos,
  public.profiles;

-- Fail the transaction if any allowlisted application row remains.
do $$
begin
  if exists (
    select 1 from public.challenge_result_members
    union all select 1 from public.challenge_results
    union all select 1 from public.pet_xp_events
    union all select 1 from public.goal_checkins
    union all select 1 from public.challenges
    union all select 1 from public.goal_assignments
    union all select 1 from public.goals
    union all select 1 from public.pet_room_items
    union all select 1 from public.pet_unlocks
    union all select 1 from public.duo_pets
    union all select 1 from public.duo_members
    union all select 1 from public.duos
    union all select 1 from public.profiles
  ) then
    raise exception 'DuoPet test-data reset verification failed; transaction rolled back';
  end if;
end;
$$;

commit;

-- After COMMIT succeeds, delete Accounts A and B from Authentication -> Users.
