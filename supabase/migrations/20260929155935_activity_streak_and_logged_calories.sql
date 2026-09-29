-- Separate per-user activity from duo-perfect achievements; future Calories
-- require actual food input and allow any logged total <= target + tolerance.
create table public.user_activity_days (
  duo_id uuid not null,
  user_id uuid not null,
  local_date date not null,
  recorded_at timestamptz not null default now(),
  primary key(duo_id,user_id,local_date),
  foreign key(duo_id,user_id) references public.duo_members(duo_id,user_id)
);
alter table public.user_activity_days enable row level security;
create policy activity_days_read_self on public.user_activity_days for select to authenticated
  using(user_id=(select auth.uid()) and private.is_duo_member(duo_id));
revoke all on public.user_activity_days from public,anon,authenticated;
grant select on public.user_activity_days to authenticated;
grant all on public.user_activity_days to service_role;

-- Infer only retained evidence. Prior undone/deleted input cannot be fabricated.
insert into public.user_activity_days(duo_id,user_id,local_date)
select g.duo_id,c.user_id,c.local_date from public.goal_checkins c join public.goals g on g.id=c.goal_id
where g.progress_source='manual' and c.value>0 and c.local_date<=private.duo_today(g.duo_id)
union
select e.duo_id,e.user_id,e.local_date from public.food_log_entries e where e.local_date<=private.duo_today(e.duo_id)
on conflict do nothing;

create function private.record_user_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_duo uuid;
begin
  if new.user_id is distinct from auth.uid() then return new; end if;
  if tg_table_name='goal_checkins' then
    if new.value<=0 or (tg_op='UPDATE' and new.value is not distinct from old.value) then return new; end if;
    select g.duo_id into target_duo from public.goals g where g.id=new.goal_id and g.progress_source='manual';
  else
    target_duo=new.duo_id;
  end if;
  if target_duo is null or new.local_date<>private.duo_today(target_duo) then return new; end if;
  insert into public.user_activity_days(duo_id,user_id,local_date) values(target_duo,new.user_id,new.local_date)
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.record_user_activity() from public,anon,authenticated;
create trigger checkins_record_activity after insert or update on public.goal_checkins
for each row execute function private.record_user_activity();
create trigger food_record_activity after insert or update on public.food_log_entries
for each row execute function private.record_user_activity();

create or replace function public.get_pet_stats(p_duo_id uuid)
returns table(total_xp bigint,perfect_days bigint,current_streak integer,best_streak integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_duo_member(p_duo_id) then raise exception 'NOT_AUTHORIZED'; end if;
  return query with activity as (
    select a.local_date from public.user_activity_days a where a.duo_id=p_duo_id
      and a.user_id=auth.uid() and a.local_date<=private.duo_today(p_duo_id)
  ), groups as (
    select a.local_date,a.local_date-(row_number() over(order by a.local_date))::integer as island from activity a
  ), runs as (
    select max(g.local_date) last_day,count(*)::integer length from groups g group by g.island
  ) select
    (select coalesce(sum(e.xp_amount),0)::bigint from public.pet_xp_events e where e.duo_id=p_duo_id and e.reversed_at is null),
    (select count(*) from public.pet_xp_events e where e.duo_id=p_duo_id and e.source_type='perfect_day' and e.reversed_at is null),
    coalesce((select max(r.length) from runs r where r.last_day in (private.duo_today(p_duo_id),private.duo_today(p_duo_id)-1)),0),
    coalesce((select max(r.length) from runs r),0);
end;
$$;

alter table public.goals add column logged_required boolean not null default false,
  add column logged_rule_effective_from date;
create or replace function private.start_goal_range() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.target_direction='range' and new.range_effective_from is null then new.range_effective_from=private.duo_today(new.duo_id); end if;
  if new.progress_source='food_calories' then
    new.logged_required=true;
    if new.logged_rule_effective_from is null then new.logged_rule_effective_from=private.duo_today(new.duo_id); end if;
  end if;
  return new;
end;
$$;
update public.goals set logged_required=true,upper_tolerance=200,
  notes=case when notes='A daily calorie target range for each person.' then 'Log food to track your daily calorie allowance.' else notes end
where progress_source='food_calories';
alter table public.goals add constraint goals_logged_rule_valid check
  (not logged_required or (progress_source='food_calories' and logged_rule_effective_from is not null));
alter table public.goal_checkins add column logged_required_snapshot boolean not null default false,
  add column has_food_log boolean not null default false;

-- The overload delegates all legacy evaluation unchanged to the previous function.
create function private.goal_completion_tier(p_tracking text,p_direction text,p_value numeric,p_target numeric,
  p_finalized timestamptz,p_lower numeric,p_upper numeric,p_partial numeric,p_logged_required boolean,p_has_food boolean)
returns text language sql immutable set search_path='' as $$
  select case when p_logged_required then case
    when not p_has_food then 'unlogged'
    when p_finalized is null then 'pending'
    when p_value<=p_target+p_upper then 'full' else 'failed' end
  else private.goal_completion_tier(p_tracking,p_direction,p_value,p_target,p_finalized,p_lower,p_upper,p_partial) end;
$$;
revoke all on function private.goal_completion_tier(text,text,numeric,numeric,timestamptz,numeric,numeric,numeric,boolean,boolean) from public,anon,authenticated;
alter table public.goal_checkins drop column completed;
alter table public.goal_checkins drop column completion_tier;
alter table public.goal_checkins
  add column completion_tier text generated always as (private.goal_completion_tier(tracking_snapshot,direction_snapshot,value,target_snapshot,finalized_at,lower_tolerance_snapshot,upper_tolerance_snapshot,partial_under_tolerance_snapshot,logged_required_snapshot,has_food_log)) stored,
  add column completed boolean generated always as (private.goal_completion_tier(tracking_snapshot,direction_snapshot,value,target_snapshot,finalized_at,lower_tolerance_snapshot,upper_tolerance_snapshot,partial_under_tolerance_snapshot,logged_required_snapshot,has_food_log) in ('full','partial')) stored;

create or replace function private.snapshot_checkin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare goal public.goals; assignment public.goal_assignments;
begin
  select * into goal from public.goals where id = new.goal_id for share;
  if goal.id is null or new.local_date > private.duo_today(goal.duo_id) then raise exception 'GOAL_UNAVAILABLE'; end if;
  select * into assignment from public.goal_assignments where goal_id = new.goal_id and user_id = new.user_id
    and active_from <= new.local_date and (active_until is null or new.local_date < active_until);
  if assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if tg_op = 'INSERT' then
    new.assignment_id = assignment.id; new.tracking_snapshot = goal.tracking_type;
    new.target_snapshot = assignment.target_value; new.unit_snapshot = assignment.canonical_unit;
    new.logged_required_snapshot=goal.logged_required and new.local_date>=goal.logged_rule_effective_from;
    new.direction_snapshot = case when goal.target_direction='range' and new.local_date < goal.range_effective_from then 'maximum' else goal.target_direction end;
    if new.direction_snapshot='range' then
      new.lower_tolerance_snapshot=goal.lower_tolerance;
      new.upper_tolerance_snapshot=goal.upper_tolerance;
      new.partial_under_tolerance_snapshot=goal.partial_under_tolerance;
    end if;
    -- A missing projection must still use the authoritative diary, never a client value.
    if goal.progress_source in ('food_calories','food_protein') then
      select coalesce(sum(e.quantity * case when goal.progress_source='food_calories' then e.calories_snapshot else e.protein_snapshot end),0)
        into new.value from public.food_log_entries e
        where e.duo_id=goal.duo_id and e.user_id=new.user_id and e.local_date=new.local_date;
    end if;
  else
    if (new.id,new.goal_id,new.user_id,new.local_date,new.tracking_snapshot,new.unit_snapshot,new.created_at)
      is distinct from (old.id,old.goal_id,old.user_id,old.local_date,old.tracking_snapshot,old.unit_snapshot,old.created_at)
    then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
    if (new.direction_snapshot,new.lower_tolerance_snapshot,new.upper_tolerance_snapshot,new.partial_under_tolerance_snapshot)
      is distinct from (old.direction_snapshot,old.lower_tolerance_snapshot,old.upper_tolerance_snapshot,old.partial_under_tolerance_snapshot)
      then raise exception 'IMMUTABLE_DIRECTION'; end if;
    if old.finalized_at is not null and (new.logged_required_snapshot,new.has_food_log) is distinct from (old.logged_required_snapshot,old.has_food_log) then raise exception 'DAY_ALREADY_CLOSED'; end if;
    if old.finalized_at is not null and (new.value,new.target_snapshot,new.finalized_at) is distinct from (old.value,old.target_snapshot,old.finalized_at)
      then raise exception 'DAY_ALREADY_CLOSED'; end if;
    if (new.assignment_id,new.target_snapshot) is distinct from (old.assignment_id,old.target_snapshot) then
      if new.user_id is distinct from auth.uid() or new.local_date <> private.duo_today(goal.duo_id)
        or new.assignment_id is distinct from assignment.id or new.target_snapshot is distinct from assignment.target_value
      then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
    end if;
    if new.finalized_at is distinct from old.finalized_at and new.local_date >= private.duo_today(goal.duo_id)
      then raise exception 'DAY_STILL_OPEN'; end if;
  end if;
  if tg_op='INSERT' or old.finalized_at is null then
    -- Open existing days adopt the new rule. Closed/pending legacy days keep their saved rule.
    if tg_op='UPDATE' and new.local_date=private.duo_today(goal.duo_id) and goal.logged_required then
      if not old.logged_required_snapshot then new.upper_tolerance_snapshot=goal.upper_tolerance; end if;
      new.logged_required_snapshot=true;
    end if;
    new.has_food_log=exists(select 1 from public.food_log_entries e
      where e.duo_id=goal.duo_id and e.user_id=new.user_id and e.local_date=new.local_date);
    if new.logged_required_snapshot then
      select coalesce(sum(e.calories_snapshot*e.quantity),0) into new.value from public.food_log_entries e
        where e.duo_id=goal.duo_id and e.user_id=new.user_id and e.local_date=new.local_date;
    end if;
  end if;
  if new.finalized_at is not null and new.local_date >= private.duo_today(goal.duo_id) then raise exception 'DAY_STILL_OPEN'; end if;
  return new;
end;
$$;

-- This updates only genuinely open rows; finalized history and XP are untouched.
update public.goal_checkins c set logged_required_snapshot=true
from public.goals g where g.id=c.goal_id and g.progress_source='food_calories'
  and c.finalized_at is null and c.local_date=private.duo_today(g.duo_id);

-- Legacy tolerance columns remain for historical reproducibility.
create or replace function public.seed_default_goals() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target_duo uuid; first_user uuid; second_user uuid; shared_targets jsonb; new_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select duo_id into target_duo from public.duo_members where user_id=uid;
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  perform 1 from public.duos where id=target_duo for update;
  if exists(select 1 from public.goals where duo_id=target_duo) then return false; end if;
  select user_id into first_user from public.duo_members where duo_id=target_duo and slot=1;
  select user_id into second_user from public.duo_members where duo_id=target_duo and slot=2;
  if first_user is null or second_user is null then return false; end if;
  shared_targets := jsonb_build_array(jsonb_build_object('user_id',first_user),jsonb_build_object('user_id',second_user));
  perform private.insert_goal_definition(target_duo,uid,'Gym','gym','shared','boolean',null,null,'Any intentional gym session counts.',shared_targets);
  perform private.insert_goal_definition(target_duo,uid,'Study','study','shared','measured','duration','hrs','Focused study time, tracked independently.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',14400),jsonb_build_object('user_id',second_user,'target',10800)));
  new_id := private.insert_goal_definition(target_duo,uid,'Calories','calories','shared','measured','number','kcal','Log food to track your daily calorie allowance.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',2200),jsonb_build_object('user_id',second_user,'target',1700)));
  update public.goals set target_direction='range',progress_source='food_calories' where id=new_id;
  new_id := private.insert_goal_definition(target_duo,uid,'Protein Intake','protein','shared','measured','number','g','Different bodies, different targets—same shared category.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',150),jsonb_build_object('user_id',second_user,'target',95)));
  update public.goals set progress_source='food_protein' where id=new_id;
  perform private.insert_goal_definition(target_duo,uid,'8K Steps','steps','shared','boolean',null,null,'Manually check this after reaching 8,000 steps.',shared_targets);
  return true;
end;
$$;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_activity_days') then
    execute 'alter publication supabase_realtime add table public.user_activity_days';
  end if;
end $$;
