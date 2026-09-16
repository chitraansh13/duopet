-- Backend Phase 2: transactional goal creation, idempotent starter goals,
-- display-unit preservation, and the narrow realtime publication used by Today.

alter table public.goals add column display_unit text;
update public.goals
set display_unit = case when tracking_type = 'measured' then case when measurement_kind = 'duration' then 'hrs' else unit end end;
alter table public.goals add constraint goals_display_unit_valid check (
  (tracking_type = 'boolean' and display_unit is null)
  or (tracking_type = 'measured' and display_unit is not null and length(btrim(display_unit)) between 1 and 30
    and (measurement_kind <> 'duration' or display_unit in ('min','hrs')))
);

-- A manager may replace an already-scheduled, unused assignment later the same
-- day. Direct clients have no assignment UPDATE/DELETE grants.
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
  if tg_op = 'UPDATE' and (new.id,new.goal_id,new.user_id,new.target_value,new.canonical_unit,new.active_from,new.created_at)
    is distinct from (old.id,old.goal_id,old.user_id,old.target_value,old.canonical_unit,old.active_from,old.created_at) then
    raise exception 'IMMUTABLE_ASSIGNMENT';
  end if;
  if tg_op = 'UPDATE' and new.active_until is not null and new.active_until <= private.duo_today(goal.duo_id) then
    raise exception 'PAST_ASSIGNMENT';
  end if;
  return new;
end;
$$;

create function private.insert_goal_definition(
  p_duo_id uuid,
  p_actor uuid,
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
declare
  goal_id uuid;
  canonical_unit text;
  participant_count integer;
  target_count integer;
  target jsonb;
  target_user uuid;
  target_value numeric;
begin
  if p_scope not in ('personal','shared') or p_tracking_type not in ('boolean','measured') then raise exception 'INVALID_GOAL'; end if;
  if jsonb_typeof(p_targets) is distinct from 'array' then raise exception 'INVALID_TARGETS'; end if;
  canonical_unit := case
    when p_tracking_type = 'boolean' then null
    when p_measurement_kind = 'duration' then 'seconds'
    else nullif(btrim(p_display_unit),'')
  end;
  if p_tracking_type = 'measured' and (p_measurement_kind not in ('number','duration') or canonical_unit is null) then
    raise exception 'INVALID_MEASUREMENT';
  end if;
  if p_measurement_kind = 'duration' and p_display_unit not in ('min','hrs') then raise exception 'INVALID_MEASUREMENT'; end if;

  select count(*) into participant_count from public.duo_members where duo_id = p_duo_id;
  target_count := jsonb_array_length(p_targets);
  if (p_scope = 'personal' and target_count <> 1) or (p_scope = 'shared' and target_count <> participant_count) then
    raise exception 'INVALID_TARGETS';
  end if;
  if (select count(distinct value->>'user_id') from jsonb_array_elements(p_targets)) <> target_count then
    raise exception 'INVALID_TARGETS';
  end if;

  insert into public.goals(
    duo_id, owner_user_id, scope, name, icon_key, tracking_type,
    measurement_kind, unit, display_unit, created_by, notes
  ) values (
    p_duo_id, case when p_scope = 'personal' then p_actor end, p_scope, btrim(p_name),
    coalesce(nullif(btrim(p_icon_key),''),'check'), p_tracking_type,
    case when p_tracking_type = 'measured' then p_measurement_kind end,
    canonical_unit, case when p_tracking_type = 'measured' then p_display_unit end,
    p_actor, nullif(btrim(p_notes),'')
  ) returning id into goal_id;

  for target in select value from jsonb_array_elements(p_targets) loop
    target_user := (target->>'user_id')::uuid;
    if not exists(select 1 from public.duo_members where duo_id = p_duo_id and user_id = target_user)
      or (p_scope = 'personal' and target_user <> p_actor) then
      raise exception 'INVALID_PARTICIPANT';
    end if;
    target_value := case when p_tracking_type = 'measured' then (target->>'target')::numeric end;
    if p_tracking_type = 'measured' and (target_value is null or target_value <= 0) then raise exception 'INVALID_TARGET'; end if;
    insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
      values(goal_id,target_user,target_value,canonical_unit,private.duo_today(p_duo_id));
  end loop;
  return goal_id;
end;
$$;

create function public.create_goal(
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
declare uid uuid := auth.uid(); target_duo uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select duo_id into target_duo from public.duo_members where user_id = uid;
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  return private.insert_goal_definition(target_duo,uid,p_name,p_icon_key,p_scope,p_tracking_type,p_measurement_kind,p_display_unit,p_notes,p_targets);
end;
$$;

create function public.update_goal(
  p_goal_id uuid,
  p_name text,
  p_icon_key text,
  p_notes text,
  p_targets jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  goal public.goals;
  today date;
  target jsonb;
  target_user uuid;
  target_value numeric;
  previous public.goal_assignments;
  scheduled public.goal_assignments;
  expected integer;
begin
  if not private.can_manage_goal(p_goal_id) then raise exception 'NOT_AUTHORIZED'; end if;
  select * into goal from public.goals where id = p_goal_id for update;
  if goal.id is null or goal.status = 'archived' then raise exception 'GOAL_UNAVAILABLE'; end if;
  update public.goals set name = btrim(p_name), icon_key = p_icon_key, notes = nullif(btrim(p_notes),'') where id = p_goal_id;
  if goal.tracking_type = 'boolean' then return; end if;
  if jsonb_typeof(p_targets) is distinct from 'array' then raise exception 'INVALID_TARGETS'; end if;
  select case when goal.scope = 'shared' then count(*) else 1 end into expected
    from public.duo_members where duo_id = goal.duo_id;
  if jsonb_array_length(p_targets) <> expected
    or (select count(distinct value->>'user_id') from jsonb_array_elements(p_targets)) <> expected then
    raise exception 'INVALID_TARGETS';
  end if;
  today := private.duo_today(goal.duo_id);
  for target in select value from jsonb_array_elements(p_targets) loop
    target_user := (target->>'user_id')::uuid;
    target_value := (target->>'target')::numeric;
    if target_value is null or target_value <= 0
      or not exists(select 1 from public.duo_members where duo_id = goal.duo_id and user_id = target_user)
      or (goal.scope = 'personal' and target_user <> goal.owner_user_id) then
      raise exception 'INVALID_TARGET';
    end if;
    select * into previous from public.goal_assignments
      where goal_id = p_goal_id and user_id = target_user and active_until is null for update;
    if previous.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
    if previous.target_value is distinct from target_value then
      if previous.active_from > today then
        scheduled := previous;
        delete from public.goal_assignments where id = scheduled.id;
        select * into previous from public.goal_assignments
          where goal_id = p_goal_id and user_id = target_user and active_until = scheduled.active_from for update;
        if previous.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
        update public.goal_assignments set active_until = null where id = previous.id;
      end if;
      update public.goal_assignments set active_until = today + 1 where id = previous.id;
      insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
        values(p_goal_id,target_user,target_value,goal.unit,today + 1);
    end if;
  end loop;
end;
$$;

create function public.replace_goal_definition(
  p_goal_id uuid,
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
declare uid uuid := auth.uid(); goal public.goals; replacement uuid;
begin
  if uid is null or not private.can_manage_goal(p_goal_id) then raise exception 'NOT_AUTHORIZED'; end if;
  select * into goal from public.goals where id = p_goal_id for update;
  if goal.id is null or goal.status = 'archived' then raise exception 'GOAL_UNAVAILABLE'; end if;
  replacement := private.insert_goal_definition(goal.duo_id,uid,p_name,p_icon_key,p_scope,p_tracking_type,p_measurement_kind,p_display_unit,p_notes,p_targets);
  update public.goals set status = 'archived' where id = p_goal_id;
  return replacement;
end;
$$;

create function public.seed_default_goals() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  target_duo uuid;
  first_user uuid;
  second_user uuid;
  shared_targets jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select duo_id into target_duo from public.duo_members where user_id = uid;
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  perform 1 from public.duos where id = target_duo for update;
  if exists(select 1 from public.goals where duo_id = target_duo) then return false; end if;
  select user_id into first_user from public.duo_members where duo_id = target_duo and slot = 1;
  select user_id into second_user from public.duo_members where duo_id = target_duo and slot = 2;
  if first_user is null or second_user is null then return false; end if;

  shared_targets := jsonb_build_array(jsonb_build_object('user_id',first_user),jsonb_build_object('user_id',second_user));
  perform private.insert_goal_definition(target_duo,uid,'Gym','gym','shared','boolean',null,null,'Any intentional gym session counts.',shared_targets);
  perform private.insert_goal_definition(target_duo,uid,'Study','study','shared','measured','duration','hrs','Focused study time, tracked independently.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',14400),jsonb_build_object('user_id',second_user,'target',10800)));
  perform private.insert_goal_definition(target_duo,uid,'Diet','calories','shared','measured','number','kcal','A daily calorie target for each person.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',2200),jsonb_build_object('user_id',second_user,'target',1700)));
  perform private.insert_goal_definition(target_duo,uid,'Protein Intake','protein','shared','measured','number','g','Different bodies, different targets—same shared category.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',150),jsonb_build_object('user_id',second_user,'target',95)));
  perform private.insert_goal_definition(target_duo,uid,'8K Steps','steps','shared','boolean',null,null,'Manually check this after reaching 8,000 steps.',shared_targets);
  return true;
end;
$$;

grant insert(display_unit) on public.goals to authenticated;
revoke all on function private.insert_goal_definition(uuid,uuid,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.create_goal(text,text,text,text,text,text,text,jsonb),
  public.update_goal(uuid,text,text,text,jsonb),
  public.replace_goal_definition(uuid,text,text,text,text,text,text,text,jsonb),
  public.seed_default_goals() from public,anon;
grant execute on function public.create_goal(text,text,text,text,text,text,text,jsonb),
  public.update_goal(uuid,text,text,text,jsonb),
  public.replace_goal_definition(uuid,text,text,text,text,text,text,text,jsonb),
  public.seed_default_goals() to authenticated;

-- Supabase creates this publication in hosted projects. PGlite does not, so
-- migration tests skip the publication block while still exercising the schema.
do $$
begin
  if exists(select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists(select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goal_checkins') then
      execute 'alter publication supabase_realtime add table public.goal_checkins';
    end if;
    if not exists(select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goals') then
      execute 'alter publication supabase_realtime add table public.goals';
    end if;
    if not exists(select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goal_assignments') then
      execute 'alter publication supabase_realtime add table public.goal_assignments';
    end if;
  end if;
end;
$$;
