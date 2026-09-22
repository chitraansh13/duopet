-- Production fresh-start: each member owns only their target, and XP is an
-- idempotent projection of authoritative check-ins.

create or replace function private.validate_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare goal public.goals;
begin
  select * into goal from public.goals where id = new.goal_id for update;
  if goal.id is null or goal.status = 'archived' then raise exception 'GOAL_UNAVAILABLE'; end if;
  if not exists(select 1 from public.duo_members where duo_id = goal.duo_id and user_id = new.user_id)
    or (goal.scope = 'personal' and new.user_id <> goal.owner_user_id) then
    raise exception 'INVALID_PARTICIPANT';
  end if;
  if tg_op = 'INSERT' and new.active_from < private.duo_today(goal.duo_id) then raise exception 'PAST_ASSIGNMENT'; end if;
  if (goal.tracking_type = 'boolean' and (new.target_value is not null or new.canonical_unit is not null))
    or (goal.tracking_type = 'measured' and (new.target_value is null or new.canonical_unit is distinct from goal.unit)) then
    raise exception 'INVALID_TARGET';
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.goal_id,new.user_id,new.canonical_unit,new.active_from,new.created_at)
      is distinct from (old.id,old.goal_id,old.user_id,old.canonical_unit,old.active_from,old.created_at) then
      raise exception 'IMMUTABLE_ASSIGNMENT';
    end if;
    if new.target_value is distinct from old.target_value and new.user_id is distinct from auth.uid() then
      raise exception 'NOT_AUTHORIZED';
    end if;
    if new.active_until is not null and new.active_until < private.duo_today(goal.duo_id) then
      raise exception 'PAST_ASSIGNMENT';
    end if;
  end if;
  return new;
end;
$$;

-- Definition edits deliberately do not mutate targets. Target changes use the
-- caller-only RPC below so a shared-goal editor can never change their partner.
create or replace function public.update_goal(
  p_goal_id uuid,
  p_name text,
  p_icon_key text,
  p_notes text,
  p_targets jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare goal public.goals;
begin
  if not private.can_manage_goal(p_goal_id) then raise exception 'NOT_AUTHORIZED'; end if;
  select * into goal from public.goals where id = p_goal_id for update;
  if goal.id is null or goal.status = 'archived' then raise exception 'GOAL_UNAVAILABLE'; end if;
  update public.goals
    set name = btrim(p_name), icon_key = p_icon_key, notes = nullif(btrim(p_notes),'')
    where id = p_goal_id;
end;
$$;

-- A creator chooses their own initial target. New shared measured goals use
-- that value as a neutral starting target for both assignments; each member
-- can then version only their own row through set_my_goal_target().
create or replace function public.create_goal(
  p_name text,
  p_icon_key text,
  p_scope text,
  p_tracking_type text,
  p_measurement_kind text,
  p_display_unit text,
  p_notes text,
  p_targets jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target_duo uuid; own_target numeric; safe_targets jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select duo_id into target_duo from public.duo_members where user_id = uid;
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  if p_tracking_type = 'measured' then
    select (value->>'target')::numeric into own_target from jsonb_array_elements(p_targets)
      where value->>'user_id' = uid::text limit 1;
    if own_target is null or own_target <= 0 then raise exception 'INVALID_TARGET'; end if;
  end if;
  select jsonb_agg(jsonb_build_object('user_id',m.user_id,'target',case when p_tracking_type='measured' then own_target end) order by m.slot)
    into safe_targets from public.duo_members m
    where m.duo_id=target_duo and (p_scope='shared' or m.user_id=uid);
  return private.insert_goal_definition(target_duo,uid,p_name,p_icon_key,p_scope,p_tracking_type,p_measurement_kind,p_display_unit,p_notes,safe_targets);
end;
$$;

create or replace function private.snapshot_checkin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare goal public.goals; assignment public.goal_assignments;
begin
  select * into goal from public.goals where id = new.goal_id for share;
  if goal.id is null or goal.status <> 'active' then raise exception 'GOAL_UNAVAILABLE'; end if;
  if new.local_date > private.duo_today(goal.duo_id) then raise exception 'FUTURE_CHECKIN'; end if;
  if tg_op = 'INSERT' then
    select * into assignment from public.goal_assignments where goal_id = new.goal_id and user_id = new.user_id
      and active_from <= new.local_date and (active_until is null or new.local_date < active_until);
    if assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
    new.assignment_id = assignment.id; new.tracking_snapshot = goal.tracking_type;
    new.target_snapshot = assignment.target_value; new.unit_snapshot = assignment.canonical_unit;
  else
    if (new.id,new.goal_id,new.user_id,new.local_date,new.tracking_snapshot,new.unit_snapshot,new.created_at)
      is distinct from (old.id,old.goal_id,old.user_id,old.local_date,old.tracking_snapshot,old.unit_snapshot,old.created_at) then
      raise exception 'IMMUTABLE_SNAPSHOT';
    end if;
    if (new.assignment_id,new.target_snapshot) is distinct from (old.assignment_id,old.target_snapshot) then
      select * into assignment from public.goal_assignments where id = new.assignment_id
        and goal_id = new.goal_id and user_id = new.user_id
        and active_from <= new.local_date and (active_until is null or new.local_date < active_until);
      if new.user_id is distinct from auth.uid() or new.local_date <> private.duo_today(goal.duo_id)
        or assignment.id is null or new.target_snapshot is distinct from assignment.target_value then
        raise exception 'IMMUTABLE_SNAPSHOT';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create function public.set_my_goal_target(p_goal_id uuid,p_target numeric,p_effective_from date)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  goal public.goals;
  today date;
  current_assignment public.goal_assignments;
  scheduled public.goal_assignments;
  replacement_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into goal from public.goals where id = p_goal_id for update;
  if goal.id is null or goal.status = 'archived' or goal.tracking_type <> 'measured'
    or not private.is_duo_member(goal.duo_id) then raise exception 'GOAL_UNAVAILABLE'; end if;
  if p_target is null or p_target <= 0 or p_target >= 'Infinity'::numeric then raise exception 'INVALID_TARGET'; end if;
  today := private.duo_today(goal.duo_id);
  if p_effective_from not in (today,today + 1) then raise exception 'INVALID_EFFECTIVE_DATE'; end if;

  select * into scheduled from public.goal_assignments
    where goal_id = p_goal_id and user_id = uid and active_from > today
    order by active_from limit 1 for update;
  if scheduled.id is not null then
    delete from public.goal_assignments where id = scheduled.id;
    update public.goal_assignments set active_until = null
      where goal_id = p_goal_id and user_id = uid and active_until = scheduled.active_from;
  end if;

  select * into current_assignment from public.goal_assignments
    where goal_id = p_goal_id and user_id = uid and active_from <= today
      and (active_until is null or today < active_until) for update;
  if current_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;

  if p_effective_from = today then
    if current_assignment.active_from = today then
      update public.goal_assignments set target_value = p_target where id = current_assignment.id
        returning id into replacement_id;
    else
      update public.goal_assignments set active_until = today where id = current_assignment.id;
      insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
        values(p_goal_id,uid,p_target,goal.unit,today) returning id into replacement_id;
    end if;
    update public.goal_checkins set assignment_id = replacement_id, target_snapshot = p_target
      where goal_id = p_goal_id and user_id = uid and local_date = today;
    return 'today';
  end if;

  update public.goal_assignments set active_until = today + 1 where id = current_assignment.id;
  insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
    values(p_goal_id,uid,p_target,goal.unit,today + 1);
  return 'tomorrow';
end;
$$;

revoke all on function public.set_my_goal_target(uuid,numeric,date) from public,anon;
grant execute on function public.set_my_goal_target(uuid,numeric,date) to authenticated;

create function private.set_xp_event(
  p_duo_id uuid,
  p_actor_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_event_key text,
  p_xp integer,
  p_local_date date,
  p_active boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_active then
    insert into public.pet_xp_events(duo_id,actor_user_id,source_type,source_id,event_key,xp_amount,local_date)
      values(p_duo_id,p_actor_user_id,p_source_type,p_source_id,p_event_key,p_xp,p_local_date)
      on conflict(duo_id,event_key) do update set reversed_at = null;
  else
    update public.pet_xp_events set reversed_at = coalesce(reversed_at,now())
      where duo_id = p_duo_id and event_key = p_event_key and reversed_at is null;
  end if;
end;
$$;

create function private.sync_checkin_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  checkin public.goal_checkins := new;
  goal public.goals;
  duo_complete boolean;
  perfect boolean;
begin
  select * into goal from public.goals where id = checkin.goal_id;
  if goal.id is null then return new; end if;

  perform private.set_xp_event(
    goal.duo_id, checkin.user_id, 'goal_completion', goal.id,
    'goal:' || goal.id || ':user:' || checkin.user_id || ':date:' || checkin.local_date,
    10, checkin.local_date, coalesce(checkin.completed,false)
  );

  if goal.scope = 'shared' then
    select count(*) >= 2 and bool_and(coalesce(c.completed,false)) into duo_complete
      from public.goal_assignments a
      left join public.goal_checkins c on c.goal_id = a.goal_id and c.user_id = a.user_id and c.local_date = checkin.local_date
      where a.goal_id = goal.id and a.active_from <= checkin.local_date
        and (a.active_until is null or checkin.local_date < a.active_until);
    perform private.set_xp_event(
      goal.duo_id, null, 'duo_goal_completion', goal.id,
      'duo_goal:' || goal.id || ':date:' || checkin.local_date,
      10, checkin.local_date, coalesce(duo_complete,false)
    );
  end if;

  select count(*) > 0 and bool_and(coalesce(c.completed,false)) into perfect
    from public.goals g
    join public.goal_assignments a on a.goal_id = g.id and a.active_from <= checkin.local_date
      and (a.active_until is null or checkin.local_date < a.active_until)
    left join public.goal_checkins c on c.goal_id = a.goal_id and c.user_id = a.user_id and c.local_date = checkin.local_date
    where g.duo_id = goal.duo_id and g.status = 'active';
  perform private.set_xp_event(
    goal.duo_id, null, 'perfect_day', goal.duo_id,
    'perfect_day:' || goal.duo_id || ':' || checkin.local_date,
    25, checkin.local_date, coalesce(perfect,false)
  );
  return new;
end;
$$;

drop trigger if exists checkins_sync_xp on public.goal_checkins;
create trigger checkins_sync_xp after insert or update on public.goal_checkins
for each row execute function private.sync_checkin_xp();

do $$
begin
  if exists(select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pet_xp_events') then
    execute 'alter publication supabase_realtime add table public.pet_xp_events';
  end if;
end;
$$;

revoke all on function private.set_xp_event(uuid,uuid,text,uuid,text,integer,date,boolean),
  private.sync_checkin_xp() from public,anon,authenticated;
