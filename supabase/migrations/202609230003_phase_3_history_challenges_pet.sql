-- Phase 3: historical goal status, canonical challenge scores/results, and durable pet unlocks.
-- All changes are additive. Existing check-ins, results, and customization stay intact.

create table public.goal_status_events (
  goal_id uuid not null references public.goals(id),
  effective_date date not null,
  status text not null check (status in ('active','paused','archived')),
  changed_at timestamptz not null default now(),
  primary key (goal_id,effective_date)
);
create index goal_status_events_date on public.goal_status_events(effective_date,goal_id);
alter table public.goal_status_events enable row level security;
create policy goal_status_read_duo on public.goal_status_events for select to authenticated
  using (exists(select 1 from public.goals g where g.id=goal_id and private.is_duo_member(g.duo_id)));
revoke all on public.goal_status_events from anon,authenticated;
grant select on public.goal_status_events to authenticated;
grant all on public.goal_status_events to service_role;

-- Earlier pause intervals cannot be inferred from the old schema. Record the known
-- lifecycle boundaries, then capture every status transition from this migration on.
insert into public.goal_status_events(goal_id,effective_date,status,changed_at)
select g.id,(g.created_at at time zone d.timezone)::date,'active',g.created_at
from public.goals g join public.duos d on d.id=g.duo_id
on conflict (goal_id,effective_date) do nothing;
insert into public.goal_status_events(goal_id,effective_date,status,changed_at)
select g.id,(g.archived_at at time zone d.timezone)::date,'archived',g.archived_at
from public.goals g join public.duos d on d.id=g.duo_id where g.archived_at is not null
on conflict (goal_id,effective_date) do update set status='archived',changed_at=excluded.changed_at;
insert into public.goal_status_events(goal_id,effective_date,status)
select g.id,private.duo_today(g.duo_id),'paused' from public.goals g where g.status='paused'
on conflict (goal_id,effective_date) do update set status='paused',changed_at=now();

create function private.record_goal_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.goal_status_events(goal_id,effective_date,status)
      values(new.id,private.duo_today(new.duo_id),new.status)
      on conflict(goal_id,effective_date) do update set status=excluded.status,changed_at=now();
  end if;
  return new;
end;
$$;
create trigger goals_record_status after insert or update of status on public.goals
for each row execute function private.record_goal_status();

-- A completed check-in already contains its historical target snapshot. No client
-- submits challenge progress. These helpers use only that generated completion flag.
create function private.challenge_score(p_challenge_id uuid,p_user_id uuid,p_through date)
returns integer language plpgsql stable security definer set search_path='' as $$
declare c public.challenges; dates date[]; day date; previous date; run integer := 0; best integer := 0;
begin
  select * into c from public.challenges where id=p_challenge_id;
  if c.id is null then return 0; end if;
  if p_user_id is null then
    select array_agg(local_date order by local_date) into dates from (
      select ci.local_date from public.goal_checkins ci
      join public.duo_members m on m.duo_id=c.duo_id and m.user_id=ci.user_id
      where ci.goal_id=c.linked_goal_id and ci.completed
        and ci.local_date between c.start_date and least(c.end_date,p_through)
      group by ci.local_date having count(distinct ci.user_id)=2
    ) both_days;
    if c.metric='completion_count' then
      select count(*) into best from public.goal_checkins ci
      join public.duo_members m on m.duo_id=c.duo_id and m.user_id=ci.user_id
      where ci.goal_id=c.linked_goal_id and ci.completed
        and ci.local_date between c.start_date and least(c.end_date,p_through);
      return best;
    end if;
  else
    select array_agg(ci.local_date order by ci.local_date) into dates from public.goal_checkins ci
      where ci.goal_id=c.linked_goal_id and ci.user_id=p_user_id and ci.completed
        and ci.local_date between c.start_date and least(c.end_date,p_through);
  end if;
  if c.metric<>'streak' then return coalesce(array_length(dates,1),0); end if;
  foreach day in array coalesce(dates,array[]::date[]) loop
    run := case when previous=day-1 then run+1 else 1 end;
    best := greatest(best,run); previous := day;
  end loop;
  return best;
end;
$$;

create function public.get_challenge_scores(p_duo_id uuid)
returns table(challenge_id uuid,user_id uuid,score integer,shared_score integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_duo_member(p_duo_id) then raise exception 'NOT_AUTHORIZED'; end if;
  return query
    select c.id,m.user_id,
      case when c.status='completed' then coalesce(rm.score,0)
        else private.challenge_score(c.id,m.user_id,private.duo_today(c.duo_id)) end,
      case when c.status='completed' then coalesce(r.shared_score,0)
        else private.challenge_score(c.id,null,private.duo_today(c.duo_id)) end
    from public.challenges c join public.duo_members m on m.duo_id=c.duo_id
    left join public.challenge_results r on r.challenge_id=c.id
    left join public.challenge_result_members rm on rm.challenge_id=c.id and rm.user_id=m.user_id
    where c.duo_id=p_duo_id and c.status<>'cancelled';
end;
$$;

create function public.finalize_due_challenges() returns integer
language plpgsql security definer set search_path='' as $$
declare c public.challenges; uid uuid := auth.uid(); member_a uuid; member_b uuid;
  score_a integer; score_b integer; shared integer; result text; winner uuid; finalized integer := 0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  for c in select ch.* from public.challenges ch join public.duo_members me on me.duo_id=ch.duo_id and me.user_id=uid
    where ch.status='active' and ch.end_date < private.duo_today(ch.duo_id)
    for update of ch loop
    select user_id into member_a from public.duo_members where duo_id=c.duo_id and slot=1;
    select user_id into member_b from public.duo_members where duo_id=c.duo_id and slot=2;
    if member_a is null or member_b is null then continue; end if;
    score_a := private.challenge_score(c.id,member_a,c.end_date);
    score_b := private.challenge_score(c.id,member_b,c.end_date);
    shared := private.challenge_score(c.id,null,c.end_date);
    if c.mode='together' then
      result := case when shared>=c.target then 'together_completed' else 'together_missed' end;
    elsif score_a=score_b then result := 'tie';
    else result := 'winner'; winner := case when score_a>score_b then member_a else member_b end;
    end if;
    insert into public.challenge_results(challenge_id,outcome,winner_user_id,shared_score,calculation_version)
      values(c.id,result,winner,shared,'checkins-v1');
    insert into public.challenge_result_members(challenge_id,user_id,score)
      values(c.id,member_a,score_a),(c.id,member_b,score_b);
    update public.challenges set status='completed' where id=c.id;
    finalized := finalized+1; winner := null;
  end loop;
  return finalized;
end;
$$;

-- Existing INSERT permission remains, but this trigger verifies the complete
-- creation rule even when a caller skips the application form.
create or replace function private.validate_challenge() returns trigger language plpgsql security definer set search_path='' as $$
declare today date;
begin
  if tg_op='UPDATE' then
    if old.status<>'active' then raise exception 'FINALIZED_CHALLENGE'; end if;
    return new;
  end if;
  if not exists(select 1 from public.goals where id=new.linked_goal_id and duo_id=new.duo_id
    and scope='shared' and status='active') then raise exception 'INVALID_CHALLENGE_GOAL'; end if;
  if (select count(*) from public.duo_members where duo_id=new.duo_id)<>2 then raise exception 'DUO_INCOMPLETE'; end if;
  today := private.duo_today(new.duo_id);
  if new.start_date<today or new.end_date<new.start_date or new.end_date>new.start_date+89
    then raise exception 'INVALID_CHALLENGE_DATES'; end if;
  if new.target>180 then raise exception 'INVALID_CHALLENGE_TARGET'; end if;
  return new;
end;
$$;
create index challenges_goal_dates on public.challenges(linked_goal_id,start_date,end_date);

-- Legacy starter unlock rows are kept for audit, but cannot authorize equipment
-- until earned. Earned rows are permanent even if XP is later reversed.
alter table public.pet_unlocks add column unlock_origin text not null default 'legacy'
  check(unlock_origin in ('legacy','default','earned'));
update public.pet_unlocks set unlock_origin='default'
  where (item_kind='accessory' and item_id in ('none','basic-collar'))
     or (item_kind='room' and item_id='cozy-bed');

create function private.award_pet_unlocks(p_duo_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare total_xp integer; level_now integer; perfect_count integer;
begin
  select coalesce(sum(xp_amount),0) into total_xp from public.pet_xp_events
    where duo_id=p_duo_id and reversed_at is null;
  level_now := total_xp/500+1;
  select count(*) into perfect_count from public.pet_xp_events
    where duo_id=p_duo_id and source_type='perfect_day' and reversed_at is null;
  insert into public.pet_unlocks(duo_id,item_kind,item_id,unlock_origin)
    select p_duo_id,v.kind,v.item,'earned' from (values
      ('accessory','lavender-collar',2,0),('accessory','oxblood-bandana',5,0),
      ('accessory','bucket-hat',6,0),('accessory','party-hat',0,7),
      ('room','tennis-ball',2,0),('room','little-plant',6,0),('room','duo-frame',0,7)
    ) v(kind,item,min_level,min_perfect)
    where (v.min_level>0 and level_now>=v.min_level)
       or (v.min_perfect>0 and perfect_count>=v.min_perfect)
    on conflict(duo_id,item_kind,item_id) do update set unlock_origin='earned'
      where public.pet_unlocks.unlock_origin='legacy';
end;
$$;
create function private.on_xp_unlock() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.award_pet_unlocks(new.duo_id); return new; end;
$$;
create trigger xp_award_unlock after insert or update of reversed_at on public.pet_xp_events
for each row execute function private.on_xp_unlock();
do $$ declare d record; begin
  for d in select duo_id from public.duo_pets loop perform private.award_pet_unlocks(d.duo_id); end loop;
end $$;

create or replace function private.validate_accessory() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.equipped_accessory_id is not null and not exists(
    select 1 from public.pet_unlocks where duo_id=new.duo_id and item_kind='accessory'
      and item_id=new.equipped_accessory_id and unlock_origin in ('default','earned'))
    then raise exception 'ACCESSORY_LOCKED'; end if;
  return new;
end;
$$;
drop policy room_select_unlocked on public.pet_room_items;
create policy room_select_unlocked on public.pet_room_items for insert to authenticated
  with check(private.is_duo_member(duo_id) and exists(
    select 1 from public.pet_unlocks u where u.duo_id=pet_room_items.duo_id
      and u.item_kind='room' and u.item_id=pet_room_items.item_id
      and u.unlock_origin in ('default','earned')));
-- Keep customization writes narrowly scoped and validated by RLS/trigger.
do $$ declare t text; begin
  foreach t in array array['challenges','challenge_results','challenge_result_members',
    'duo_pets','pet_room_items','pet_unlocks','goal_status_events'] loop
    if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
      and not exists(select 1 from pg_catalog.pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

revoke all on function private.challenge_score(uuid,uuid,date),private.award_pet_unlocks(uuid),
  private.on_xp_unlock(),private.record_goal_status() from public,anon,authenticated;
revoke all on function public.get_challenge_scores(uuid),public.finalize_due_challenges() from public,anon;
grant execute on function public.get_challenge_scores(uuid),public.finalize_due_challenges() to authenticated;

-- Lifetime totals and streaks stay in PostgreSQL; the browser only loads a
-- bounded recent XP window for activity/calendar details.
create function public.get_pet_stats(p_duo_id uuid)
returns table(total_xp bigint,perfect_days bigint,current_streak integer,best_streak integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_duo_member(p_duo_id) then raise exception 'NOT_AUTHORIZED'; end if;
  return query with perfect as (
    select distinct e.local_date from public.pet_xp_events e where e.duo_id=p_duo_id
      and e.source_type='perfect_day' and e.reversed_at is null
  ), groups as (
    select p.local_date,p.local_date-(row_number() over(order by p.local_date))::integer as island from perfect p
  ), runs as (
    select max(g.local_date) as last_day,count(*)::integer as length from groups g group by g.island
  )
  select
    (select coalesce(sum(e.xp_amount),0)::bigint from public.pet_xp_events e
      where e.duo_id=p_duo_id and e.reversed_at is null),
    (select count(*) from perfect),
    coalesce((select max(r.length) from runs r where r.last_day in
      (private.duo_today(p_duo_id),private.duo_today(p_duo_id)-1)),0),
    coalesce((select max(r.length) from runs r),0);
end;
$$;
revoke all on function public.get_pet_stats(uuid) from public,anon;
grant execute on function public.get_pet_stats(uuid) to authenticated;
