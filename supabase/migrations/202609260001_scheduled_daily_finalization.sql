-- Run the existing authenticated finalizers for one member of each duo.
-- Only the database owner / pg_cron may execute this wrapper. Client grants stay unchanged.
create function private.run_scheduled_finalization() returns integer
language plpgsql security definer set search_path = '' as $$
declare member_uid uuid; previous_claim text := current_setting('request.jwt.claim.sub',true);
  finalized integer := 0;
begin
  if session_user <> 'postgres' then raise exception 'SCHEDULER_ONLY'; end if;
  for member_uid in
    select distinct on (m.duo_id) m.user_id
    from public.duo_members m order by m.duo_id,m.slot
  loop
    perform set_config('request.jwt.claim.sub',member_uid::text,true);
    finalized := finalized + public.finalize_due_goal_days();
    finalized := finalized + public.finalize_due_challenges();
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(previous_claim,''),true);
  return finalized;
end;
$$;

revoke all on function private.run_scheduled_finalization() from public,anon,authenticated;
comment on function private.run_scheduled_finalization() is
  'Database-owner cron wrapper for the existing idempotent, duo-timezone-aware finalizers.';

-- pg_cron is enabled in the hosted Supabase project before this migration.
-- Embedded/local databases without that optional extension retain lazy finalization.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('duopet-finalize-due-days','17 * * * *',
      'select private.run_scheduled_finalization()');
  else
    raise notice 'pg_cron is unavailable; enable it and schedule duopet-finalize-due-days as documented';
  end if;
end;
$$;
