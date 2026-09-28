-- Dynamic calorie ranges. Existing check-in directions/targets/XP remain intact.
-- The existing hourly wrapper continues calling finalize_due_goal_days().
alter table public.goals drop constraint goals_target_direction_check;
alter table public.goals drop constraint goals_source_valid;
alter table public.goals
  add constraint goals_target_direction_check check (target_direction in ('minimum','maximum','range')),
  add column lower_tolerance numeric not null default 200 check (lower_tolerance>=0 and lower_tolerance<='100000'::numeric),
  add column upper_tolerance numeric not null default 200 check (upper_tolerance>=0 and upper_tolerance<='100000'::numeric),
  add column partial_under_tolerance numeric not null default 200 check (partial_under_tolerance>=0 and partial_under_tolerance<='100000'::numeric),
  add column range_effective_from date;
alter table public.goals add constraint goals_source_valid check (
  (tracking_type='boolean' and target_direction='minimum' and progress_source='manual') or
  (tracking_type='measured' and (
    (progress_source='manual' and target_direction in ('minimum','maximum')) or
    (progress_source='food_calories' and measurement_kind='number' and unit='kcal' and target_direction in ('maximum','range')) or
    (progress_source='food_protein' and measurement_kind='number' and unit='g' and target_direction='minimum')
  ))
);

create function private.start_goal_range() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.target_direction='range' and new.range_effective_from is null then
    new.range_effective_from=private.duo_today(new.duo_id);
  end if;
  return new;
end;
$$;
revoke all on function private.start_goal_range() from public,anon,authenticated;
create trigger goals_start_range before insert or update on public.goals
for each row execute function private.start_goal_range();
update public.goals set target_direction='range',
  notes=case when notes='A daily calorie maximum for each person.' then 'A daily calorie target range for each person.' else notes end
where progress_source='food_calories' and target_direction='maximum';
alter table public.goals add constraint goals_range_start_valid check (target_direction<>'range' or range_effective_from is not null);

alter table public.goal_checkins drop constraint goal_checkins_direction_snapshot_check;
alter table public.goal_checkins
  add constraint goal_checkins_direction_snapshot_check check (direction_snapshot in ('minimum','maximum','range')),
  add column lower_tolerance_snapshot numeric,
  add column upper_tolerance_snapshot numeric,
  add column partial_under_tolerance_snapshot numeric,
  add constraint checkins_range_snapshot_valid check (direction_snapshot<>'range' or (
    lower_tolerance_snapshot is not null and lower_tolerance_snapshot between 0 and 100000 and
    upper_tolerance_snapshot is not null and upper_tolerance_snapshot between 0 and 100000 and
    partial_under_tolerance_snapshot is not null and partial_under_tolerance_snapshot between 0 and 100000));

-- A single immutable semantic evaluator feeds both stored completion and XP tier.
create function private.goal_completion_tier(p_tracking text,p_direction text,p_value numeric,p_target numeric,
  p_finalized timestamptz,p_lower numeric,p_upper numeric,p_partial numeric) returns text
language sql immutable set search_path='' as $$
  select case
    when p_tracking='boolean' then case when p_value=1 then 'full' else 'failed' end
    when p_direction in ('maximum','range') and p_finalized is null then 'pending'
    when p_direction='range' then case
      when p_value between p_target-p_lower and p_target+p_upper then 'full'
      when p_value>=p_target-p_lower-p_partial and p_value<p_target-p_lower then 'partial'
      else 'failed' end
    when p_direction='maximum' then case when p_value<=p_target then 'full' else 'failed' end
    else case when p_value>=p_target then 'full' else 'failed' end end;
$$;
revoke all on function private.goal_completion_tier(text,text,numeric,numeric,timestamptz,numeric,numeric,numeric) from public,anon,authenticated;
alter table public.goal_checkins drop column completed;
alter table public.goal_checkins
  add column completion_tier text generated always as (private.goal_completion_tier(tracking_snapshot,direction_snapshot,value,target_snapshot,finalized_at,lower_tolerance_snapshot,upper_tolerance_snapshot,partial_under_tolerance_snapshot)) stored,
  add column completed boolean generated always as (private.goal_completion_tier(tracking_snapshot,direction_snapshot,value,target_snapshot,finalized_at,lower_tolerance_snapshot,upper_tolerance_snapshot,partial_under_tolerance_snapshot) in ('full','partial')) stored;

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
  if new.finalized_at is not null and new.local_date >= private.duo_today(goal.duo_id) then raise exception 'DAY_STILL_OPEN'; end if;
  return new;
end;
$$;

create or replace function private.sync_checkin_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare checkin public.goal_checkins := new; goal public.goals; duo_complete boolean; perfect boolean;
begin
  select * into goal from public.goals where id=checkin.goal_id;
  if goal.id is null then return new; end if;
  perform private.set_xp_event(goal.duo_id,checkin.user_id,'goal_completion',goal.id,
    'goal:'||goal.id||':user:'||checkin.user_id||':date:'||checkin.local_date,
    case when checkin.completion_tier='partial' then 5 else 10 end,checkin.local_date,coalesce(checkin.completed,false));
  if goal.scope='shared' then
    select count(*)>=2 and bool_and(coalesce(c.completed,false)) into duo_complete
    from public.goal_assignments a left join public.goal_checkins c
      on c.goal_id=a.goal_id and c.user_id=a.user_id and c.local_date=checkin.local_date
    where a.goal_id=goal.id and a.active_from<=checkin.local_date
      and (a.active_until is null or checkin.local_date<a.active_until);
    perform private.set_xp_event(goal.duo_id,null,'duo_goal_completion',goal.id,
      'duo_goal:'||goal.id||':date:'||checkin.local_date,10,checkin.local_date,coalesce(duo_complete,false));
  end if;
  select count(*)>0 and bool_and(coalesce(c.completed,false)) into perfect
  from public.goals g join public.goal_assignments a on a.goal_id=g.id
    and a.active_from<=checkin.local_date and (a.active_until is null or checkin.local_date<a.active_until)
  left join public.goal_checkins c on c.goal_id=a.goal_id and c.user_id=a.user_id and c.local_date=checkin.local_date
  where g.duo_id=goal.duo_id and
    (select s.status from public.goal_status_events s where s.goal_id=g.id and s.effective_date<=checkin.local_date
      order by s.effective_date desc limit 1)='active';
  perform private.set_xp_event(goal.duo_id,null,'perfect_day',goal.duo_id,
    'perfect_day:'||goal.duo_id||':'||checkin.local_date,25,checkin.local_date,coalesce(perfect,false));
  return new;
end;
$$;

create or replace function public.finalize_due_goal_days() returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target_duo uuid; today date; day date; item record; n integer := 0; start_day date;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select duo_id into target_duo from public.duo_members where user_id=uid;
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  today := private.duo_today(target_duo);
  perform 1 from public.duos where id=target_duo for update;
  for item in
    select g.id as goal_id,a.user_id,a.active_from,a.active_until,
      (g.created_at at time zone d.timezone)::date as created_day
    from public.goals g join public.goal_assignments a on a.goal_id=g.id
    join public.duos d on d.id=g.duo_id
    where g.duo_id=target_duo and g.target_direction in ('maximum','range')
  loop
    select greatest(item.created_day,item.active_from,coalesce(max(c.local_date)+1,item.active_from)) into start_day
      from public.goal_checkins c where c.goal_id=item.goal_id and c.user_id=item.user_id and c.finalized_at is not null;
    for day in select generate_series(start_day,
      least(today-1,coalesce(item.active_until-1,today-1)),'1 day'::interval)::date loop
      if (select s.status from public.goal_status_events s where s.goal_id=item.goal_id and s.effective_date<=day
        order by s.effective_date desc limit 1) <> 'active' then continue; end if;
      if exists(select 1 from public.goal_checkins c where c.goal_id=item.goal_id and c.user_id=item.user_id
        and c.local_date=day and c.finalized_at is not null) then continue; end if;
      insert into public.goal_checkins(goal_id,user_id,local_date,value,finalized_at)
        values(item.goal_id,item.user_id,day,0,now())
        on conflict(goal_id,user_id,local_date) do update set finalized_at=now();
      n := n+1;
    end loop;
  end loop;
  return n;
end;
$$;

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
  new_id := private.insert_goal_definition(target_duo,uid,'Calories','calories','shared','measured','number','kcal','A daily calorie target range for each person.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',2200),jsonb_build_object('user_id',second_user,'target',1700)));
  update public.goals set target_direction='range',progress_source='food_calories' where id=new_id;
  new_id := private.insert_goal_definition(target_duo,uid,'Protein Intake','protein','shared','measured','number','g','Different bodies, different targets—same shared category.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',150),jsonb_build_object('user_id',second_user,'target',95)));
  update public.goals set progress_source='food_protein' where id=new_id;
  perform private.insert_goal_definition(target_duo,uid,'8K Steps','steps','shared','boolean',null,null,'Manually check this after reaching 8,000 steps.',shared_targets);
  return true;
end;
$$;
