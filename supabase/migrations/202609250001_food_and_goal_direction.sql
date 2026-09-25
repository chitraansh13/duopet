-- Food is a shared catalog, but a private diary. Nutrition check-ins are a
-- server-owned projection of that diary; completed maximum days close lazily.
alter table public.goals
  add column target_direction text not null default 'minimum' check (target_direction in ('minimum','maximum')),
  add column progress_source text not null default 'manual' check (progress_source in ('manual','food_calories','food_protein'));
alter table public.goals add constraint goals_source_valid check (
  (tracking_type = 'boolean' and target_direction = 'minimum' and progress_source = 'manual')
  or (tracking_type = 'measured' and (
    progress_source = 'manual'
    or (progress_source = 'food_calories' and measurement_kind = 'number' and unit = 'kcal' and target_direction = 'maximum')
    or (progress_source = 'food_protein' and measurement_kind = 'number' and unit = 'g' and target_direction = 'minimum')
  ))
);

-- Old check-ins retain minimum semantics. In particular, migration never
-- reinterprets or deletes historical manually-entered Diet/Protein values.
alter table public.goal_checkins
  add column direction_snapshot text not null default 'minimum' check (direction_snapshot in ('minimum','maximum')),
  add column finalized_at timestamptz;
alter table public.goal_checkins drop column completed;
alter table public.goal_checkins add column completed boolean generated always as (
  case when tracking_snapshot = 'boolean' then value = 1
       when direction_snapshot = 'maximum' then finalized_at is not null and value <= target_snapshot
       else value >= target_snapshot end
) stored;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id),
  created_by uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  serving_description text not null check (length(btrim(serving_description)) between 1 and 100),
  calories_per_serving numeric(10,2) not null check (calories_per_serving between 0 and 100000),
  protein_grams_per_serving numeric(10,2) not null check (protein_grams_per_serving between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(id,duo_id),
  foreign key(duo_id,created_by) references public.duo_members(duo_id,user_id)
);
create index foods_duo_name on public.foods(duo_id,lower(name)) where archived_at is null;
create trigger foods_updated before update on public.foods for each row execute function private.touch_updated_at();
alter table public.foods enable row level security;
create policy foods_read_duo on public.foods for select to authenticated using (private.is_duo_member(duo_id));
create policy foods_insert_self on public.foods for insert to authenticated with check
  (private.is_duo_member(duo_id) and created_by = (select auth.uid()) and archived_at is null);
create policy foods_update_creator on public.foods for update to authenticated
  using (created_by = (select auth.uid()) and private.is_duo_member(duo_id))
  with check (created_by = (select auth.uid()) and private.is_duo_member(duo_id));
revoke all on public.foods from anon,authenticated;
grant select on public.foods to authenticated;
grant insert(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) on public.foods to authenticated;
grant update(name,serving_description,calories_per_serving,protein_grams_per_serving,archived_at) on public.foods to authenticated;
grant all on public.foods to service_role;

create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id),
  user_id uuid not null,
  food_id uuid not null,
  local_date date not null,
  quantity numeric(8,2) not null check (quantity > 0 and quantity <= 100),
  calories_snapshot numeric(10,2) not null check (calories_snapshot between 0 and 100000),
  protein_snapshot numeric(10,2) not null check (protein_snapshot between 0 and 10000),
  serving_snapshot text not null,
  food_name_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(duo_id,user_id) references public.duo_members(duo_id,user_id),
  foreign key(food_id,duo_id) references public.foods(id,duo_id)
);
create index food_logs_user_day on public.food_log_entries(user_id,local_date,created_at desc);
create index food_logs_user_food on public.food_log_entries(user_id,food_id,created_at desc);
create trigger food_logs_updated before update on public.food_log_entries for each row execute function private.touch_updated_at();
alter table public.food_log_entries enable row level security;
create policy food_logs_read_self on public.food_log_entries for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.food_log_entries from anon,authenticated;
grant select on public.food_log_entries to authenticated;
grant all on public.food_log_entries to service_role;

-- Table writes are unavailable to clients, including food-linked check-ins.
-- The narrow RPC below remains the only client mutation path for manual goals.
revoke insert(goal_id,user_id,local_date,value),update(value) on public.goal_checkins from authenticated;
revoke insert,update on public.goal_checkins from authenticated;
create or replace function public.set_goal_checkin(p_goal_id uuid,p_local_date date,p_value numeric)
returns public.goal_checkins language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); goal public.goals; saved public.goal_checkins;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into goal from public.goals where id = p_goal_id;
  if goal.id is null or goal.status <> 'active' or goal.progress_source <> 'manual'
    or not private.is_duo_member(goal.duo_id)
    or p_local_date > private.duo_today(goal.duo_id)
    or (goal.target_direction = 'maximum' and p_local_date <> private.duo_today(goal.duo_id))
    or not exists(select 1 from public.goal_assignments a where a.goal_id = p_goal_id and a.user_id = uid
      and a.active_from <= p_local_date and (a.active_until is null or p_local_date < a.active_until))
  then raise exception 'NOT_AUTHORIZED'; end if;
  insert into public.goal_checkins(goal_id,user_id,local_date,value)
    values(p_goal_id,uid,p_local_date,p_value)
    on conflict(goal_id,user_id,local_date) do update set value = excluded.value
    returning * into saved;
  return saved;
end;
$$;


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
    new.direction_snapshot = goal.target_direction;
  else
    if (new.id,new.goal_id,new.user_id,new.local_date,new.tracking_snapshot,new.unit_snapshot,new.created_at)
      is distinct from (old.id,old.goal_id,old.user_id,old.local_date,old.tracking_snapshot,old.unit_snapshot,old.created_at)
    then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
    if new.direction_snapshot is distinct from old.direction_snapshot then raise exception 'IMMUTABLE_DIRECTION'; end if;
    if (new.assignment_id,new.target_snapshot) is distinct from (old.assignment_id,old.target_snapshot) then
      if new.user_id is distinct from auth.uid() or new.local_date <> private.duo_today(goal.duo_id)
        or new.assignment_id is distinct from assignment.id or new.target_snapshot is distinct from assignment.target_value
      then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
    end if;
    if new.finalized_at is distinct from old.finalized_at and new.local_date >= private.duo_today(goal.duo_id)
      then raise exception 'DAY_STILL_OPEN'; end if;
  end if;
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
    10,checkin.local_date,coalesce(checkin.completed,false));
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

-- The catalog remains editable, but snapshots in existing diary rows never
-- change. All diary changes and goal projections commit in one transaction.
create function private.sync_food_goals(p_duo_id uuid,p_user_id uuid,p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare goal record; total numeric;
begin
  for goal in
    select g.id,g.progress_source from public.goals g
    join public.goal_assignments a on a.goal_id=g.id and a.user_id=p_user_id
      and a.active_from<=p_day and (a.active_until is null or p_day<a.active_until)
    where g.duo_id=p_duo_id and g.status='active' and g.progress_source in ('food_calories','food_protein')
  loop
    select coalesce(sum(case when goal.progress_source='food_calories'
      then e.calories_snapshot else e.protein_snapshot end * e.quantity),0)
      into total from public.food_log_entries e where e.duo_id=p_duo_id and e.user_id=p_user_id and e.local_date=p_day;
    insert into public.goal_checkins(goal_id,user_id,local_date,value)
      values(goal.id,p_user_id,p_day,total)
      on conflict(goal_id,user_id,local_date) do update set value=excluded.value;
  end loop;
end;
$$;

create function public.create_directed_goal(
  p_name text,p_icon_key text,p_scope text,p_tracking_type text,p_measurement_kind text,
  p_display_unit text,p_notes text,p_targets jsonb,p_target_direction text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_target_direction not in ('minimum','maximum') or
    (p_tracking_type='boolean' and p_target_direction<>'minimum') then raise exception 'INVALID_DIRECTION'; end if;
  new_id := public.create_goal(p_name,p_icon_key,p_scope,p_tracking_type,p_measurement_kind,p_display_unit,p_notes,p_targets);
  update public.goals set target_direction=p_target_direction where id=new_id;
  return new_id;
end;
$$;

create function public.save_food_log(p_food_id uuid,p_quantity numeric,p_entry_id uuid default null)
returns public.food_log_entries language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); food public.foods; previous public.food_log_entries; saved public.food_log_entries; day date;
begin
  if uid is null or p_quantity is null or p_quantity <= 0 or p_quantity > 100 or p_quantity >= 'Infinity'::numeric
    then raise exception 'INVALID_QUANTITY'; end if;
  select * into food from public.foods where id=p_food_id;
  if food.id is null or not private.is_duo_member(food.duo_id) then raise exception 'FOOD_UNAVAILABLE'; end if;
  perform 1 from public.duos where id=food.duo_id for update;
  day := private.duo_today(food.duo_id);
  if p_entry_id is null then
    if food.archived_at is not null then raise exception 'FOOD_UNAVAILABLE'; end if;
    insert into public.food_log_entries(duo_id,user_id,food_id,local_date,quantity,calories_snapshot,protein_snapshot,serving_snapshot,food_name_snapshot)
      values(food.duo_id,uid,food.id,day,p_quantity,food.calories_per_serving,food.protein_grams_per_serving,food.serving_description,food.name)
      returning * into saved;
  else
    select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid for update;
    if previous.id is null or previous.duo_id<>food.duo_id or previous.food_id<>food.id or previous.local_date<>day
      then raise exception 'LOG_UNAVAILABLE'; end if;
    update public.food_log_entries set quantity=p_quantity where id=p_entry_id returning * into saved;
  end if;
  perform private.sync_food_goals(food.duo_id,uid,day);
  return saved;
end;
$$;

create function public.delete_food_log(p_entry_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); previous public.food_log_entries;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid;
  if previous.id is null or previous.local_date<>private.duo_today(previous.duo_id) then raise exception 'LOG_UNAVAILABLE'; end if;
  perform 1 from public.duos where id=previous.duo_id for update;
  select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid for update;
  if previous.id is null or previous.local_date<>private.duo_today(previous.duo_id) then raise exception 'LOG_UNAVAILABLE'; end if;
  delete from public.food_log_entries where id=p_entry_id;
  perform private.sync_food_goals(previous.duo_id,uid,previous.local_date);
  return true;
end;
$$;

-- One invocation on authenticated load and on duo-day rollover closes every
-- pending eligible day. The latest finalized day bounds repeat work.
create function public.finalize_due_goal_days() returns integer
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
    where g.duo_id=target_duo and g.target_direction='maximum'
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

revoke all on function private.sync_food_goals(uuid,uuid,date),public.save_food_log(uuid,numeric,uuid),
  public.delete_food_log(uuid),public.finalize_due_goal_days(),
  public.create_directed_goal(text,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_food_log(uuid,numeric,uuid),public.delete_food_log(uuid),
  public.finalize_due_goal_days(),public.create_directed_goal(text,text,text,text,text,text,text,jsonb,text) to authenticated;
revoke all on function public.replace_goal_assignment(uuid,uuid,numeric,date),
  public.replace_goal_definition(uuid,text,text,text,text,text,text,text,jsonb) from authenticated;

-- Exact untouched starter definitions are replaced, never rewritten. Original
-- check-ins and challenge links remain on the archived definitions.
do $$
declare old_goal public.goals; new_goal_id uuid; member record;
begin
  for old_goal in select * from public.goals where scope='shared' and status<>'archived' and progress_source='manual'
    and tracking_type='measured' and measurement_kind='number'
    and ((name in ('Diet','Calories') and icon_key='calories' and unit='kcal')
      or (name in ('Protein Intake','Protein') and icon_key='protein' and unit='g'))
  loop
    insert into public.goals(duo_id,scope,name,icon_key,tracking_type,measurement_kind,unit,display_unit,created_by,notes,status,target_direction,progress_source)
      values(old_goal.duo_id,'shared',case when old_goal.name='Diet' and old_goal.notes='A daily calorie target for each person.' then 'Calories' else old_goal.name end,
        old_goal.icon_key,'measured','number',old_goal.unit,old_goal.display_unit,old_goal.created_by,old_goal.notes,old_goal.status,
        case when old_goal.unit='kcal' then 'maximum' else 'minimum' end,
        case when old_goal.unit='kcal' then 'food_calories' else 'food_protein' end)
      returning id into new_goal_id;
    for member in select a.user_id,a.target_value from public.goal_assignments a where a.goal_id=old_goal.id
      and a.active_from<=private.duo_today(old_goal.duo_id)
      and (a.active_until is null or private.duo_today(old_goal.duo_id)<a.active_until)
    loop
      insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
        values(new_goal_id,member.user_id,member.target_value,old_goal.unit,private.duo_today(old_goal.duo_id));
    end loop;
    update public.goals set status='archived' where id=old_goal.id;
  end loop;
end;
$$;

-- A perfect-day award made earlier today cannot remain final after the new
-- open-day calorie maximum joins the goal set.
update public.pet_xp_events e set reversed_at=coalesce(e.reversed_at,now())
where e.source_type='perfect_day' and e.reversed_at is null
  and e.local_date=private.duo_today(e.duo_id)
  and exists(select 1 from public.goals g where g.duo_id=e.duo_id
    and g.status='active' and g.progress_source='food_calories');

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
  new_id := private.insert_goal_definition(target_duo,uid,'Calories','calories','shared','measured','number','kcal','A daily calorie maximum for each person.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',2200),jsonb_build_object('user_id',second_user,'target',1700)));
  update public.goals set target_direction='maximum',progress_source='food_calories' where id=new_id;
  new_id := private.insert_goal_definition(target_duo,uid,'Protein Intake','protein','shared','measured','number','g','Different bodies, different targets—same shared category.',
    jsonb_build_array(jsonb_build_object('user_id',first_user,'target',150),jsonb_build_object('user_id',second_user,'target',95)));
  update public.goals set progress_source='food_protein' where id=new_id;
  perform private.insert_goal_definition(target_duo,uid,'8K Steps','steps','shared','boolean',null,null,'Manually check this after reaching 8,000 steps.',shared_targets);
  return true;
end;
$$;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='foods') then
      execute 'alter publication supabase_realtime add table public.foods';
    end if;
    if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='food_log_entries') then
      execute 'alter publication supabase_realtime add table public.food_log_entries';
    end if;
  end if;
end $$;
