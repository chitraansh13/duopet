-- Phase 1: versioned goals and authoritative daily snapshots. No UI provider migration.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id),
  owner_user_id uuid,
  scope text not null check(scope in ('personal','shared')),
  name text not null check(length(btrim(name)) between 1 and 120),
  icon_key text not null default 'check' check(length(icon_key) between 1 and 80),
  tracking_type text not null check(tracking_type in ('boolean','measured')),
  measurement_kind text check(measurement_kind in ('number','duration')),
  unit text check(length(btrim(unit)) between 1 and 30),
  status text not null default 'active' check(status in ('active','paused','archived')),
  created_by uuid not null,
  notes text check(length(notes)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(id,duo_id),
  foreign key(duo_id,owner_user_id) references public.duo_members(duo_id,user_id),
  foreign key(duo_id,created_by) references public.duo_members(duo_id,user_id),
  check((scope='personal' and owner_user_id is not null) or (scope='shared' and owner_user_id is null)),
  check((tracking_type='boolean' and measurement_kind is null and unit is null)
     or (tracking_type='measured' and measurement_kind is not null and unit is not null)),
  check(measurement_kind is distinct from 'duration' or unit='seconds'),
  check((status='archived')=(archived_at is not null))
);
create index goals_duo_status on public.goals(duo_id,status);
create function private.can_manage_goal(goal_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.goals g where g.id=goal_uuid and private.is_duo_member(g.duo_id)
    and (g.scope='shared' or g.owner_user_id=(select auth.uid())));
$$;
create function private.archive_goal() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='archived' then new.archived_at=coalesce(old.archived_at,now()); else new.archived_at=null; end if;
  return new;
end;
$$;
create trigger goals_archive before update on public.goals for each row execute function private.archive_goal();
create trigger goals_updated before update on public.goals for each row execute function private.touch_updated_at();

create table public.goal_assignments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id),
  user_id uuid not null references public.profiles(id),
  target_value numeric check(target_value>0 and target_value<'Infinity'::numeric),
  canonical_unit text,
  active_from date not null,
  active_until date,
  created_at timestamptz not null default now(),
  unique(id,goal_id,user_id),
  check(active_until is null or active_until>active_from),
  exclude using gist(goal_id extensions.gist_uuid_ops with =,user_id extensions.gist_uuid_ops with =,daterange(active_from,active_until,'[)') with &&)
);
create index assignments_goal_user on public.goal_assignments(goal_id,user_id);
create function private.validate_assignment() returns trigger language plpgsql security definer set search_path='' as $$
declare goal public.goals;
begin
  select * into goal from public.goals where id=new.goal_id for update;
  if goal.id is null or goal.status='archived' then raise exception 'GOAL_UNAVAILABLE'; end if;
  if not exists(select 1 from public.duo_members where duo_id=goal.duo_id and user_id=new.user_id) or
    (goal.scope='personal' and new.user_id<>goal.owner_user_id) then raise exception 'INVALID_PARTICIPANT'; end if;
  if tg_op='INSERT' and new.active_from<private.duo_today(goal.duo_id) then raise exception 'PAST_ASSIGNMENT'; end if;
  if (goal.tracking_type='boolean' and (new.target_value is not null or new.canonical_unit is not null)) or
     (goal.tracking_type='measured' and (new.target_value is null or new.canonical_unit is distinct from goal.unit)) then raise exception 'INVALID_TARGET'; end if;
  if tg_op='UPDATE' and (new.id,new.goal_id,new.user_id,new.target_value,new.canonical_unit,new.active_from,new.created_at)
    is distinct from (old.id,old.goal_id,old.user_id,old.target_value,old.canonical_unit,old.active_from,old.created_at) then raise exception 'IMMUTABLE_ASSIGNMENT'; end if;
  if tg_op='UPDATE' and (new.active_until is null or new.active_until<=private.duo_today(goal.duo_id)) then raise exception 'PAST_ASSIGNMENT'; end if;
  return new;
end;
$$;
create trigger assignments_validate before insert or update on public.goal_assignments for each row execute function private.validate_assignment();

-- Target changes become effective tomorrow or later. Closing/inserting is atomic.
create function public.replace_goal_assignment(p_goal_id uuid,p_user_id uuid,p_target numeric,p_effective_from date) returns uuid
language plpgsql security definer set search_path='' as $$
declare goal public.goals; previous public.goal_assignments; new_id uuid;
begin
  if not private.can_manage_goal(p_goal_id) then raise exception 'NOT_AUTHORIZED'; end if;
  select * into goal from public.goals where id=p_goal_id for update;
  if p_effective_from is null or p_effective_from<=private.duo_today(goal.duo_id) then raise exception 'FUTURE_DATE_REQUIRED'; end if;
  select * into previous from public.goal_assignments where goal_id=p_goal_id and user_id=p_user_id and active_until is null for update;
  if previous.id is null or p_effective_from<=previous.active_from then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  update public.goal_assignments set active_until=p_effective_from where id=previous.id;
  insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from)
    values(p_goal_id,p_user_id,p_target,goal.unit,p_effective_from) returning id into new_id;
  return new_id;
end;
$$;

create table public.goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id),
  user_id uuid not null references public.profiles(id),
  assignment_id uuid not null,
  local_date date not null,
  value numeric not null check(value>=0 and value<'Infinity'::numeric),
  tracking_snapshot text not null check(tracking_snapshot in ('boolean','measured')),
  target_snapshot numeric,
  unit_snapshot text,
  completed boolean generated always as
    (case when tracking_snapshot='boolean' then value=1 else value>=target_snapshot end) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(goal_id,user_id,local_date),
  foreign key(assignment_id,goal_id,user_id) references public.goal_assignments(id,goal_id,user_id),
  check((tracking_snapshot='boolean' and value in (0,1) and target_snapshot is null and unit_snapshot is null)
    or (tracking_snapshot='measured' and target_snapshot>0 and target_snapshot<'Infinity'::numeric and target_snapshot is not null and unit_snapshot is not null))
);
create index checkins_user_date on public.goal_checkins(user_id,local_date);
create index checkins_goal_date on public.goal_checkins(goal_id,local_date);
create function private.snapshot_checkin() returns trigger language plpgsql security definer set search_path='' as $$
declare goal public.goals; assignment public.goal_assignments;
begin
  select * into goal from public.goals where id=new.goal_id for share;
  if goal.id is null or goal.status<>'active' then raise exception 'GOAL_UNAVAILABLE'; end if;
  if new.local_date>private.duo_today(goal.duo_id) then raise exception 'FUTURE_CHECKIN'; end if;
  if tg_op='INSERT' then
    select * into assignment from public.goal_assignments where goal_id=new.goal_id and user_id=new.user_id
      and active_from<=new.local_date and (active_until is null or new.local_date<active_until);
    if assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
    new.assignment_id=assignment.id; new.tracking_snapshot=goal.tracking_type;
    new.target_snapshot=assignment.target_value; new.unit_snapshot=assignment.canonical_unit;
  else
    if (new.id,new.goal_id,new.user_id,new.local_date,new.assignment_id,new.tracking_snapshot,new.target_snapshot,new.unit_snapshot,new.created_at)
      is distinct from (old.id,old.goal_id,old.user_id,old.local_date,old.assignment_id,old.tracking_snapshot,old.target_snapshot,old.unit_snapshot,old.created_at)
      then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
  end if;
  return new;
end;
$$;
create trigger checkins_snapshot before insert or update on public.goal_checkins for each row execute function private.snapshot_checkin();
create trigger checkins_updated before update on public.goal_checkins for each row execute function private.touch_updated_at();

alter table public.goals enable row level security;
alter table public.goal_assignments enable row level security;
alter table public.goal_checkins enable row level security;
create policy goals_read_duo on public.goals for select to authenticated using(private.is_duo_member(duo_id));
create policy goals_create_member on public.goals for insert to authenticated with check(private.is_duo_member(duo_id) and created_by=(select auth.uid()) and status='active' and (scope='shared' or owner_user_id=(select auth.uid())));
create policy goals_manage_member on public.goals for update to authenticated using(private.can_manage_goal(id)) with check(private.can_manage_goal(id));
create policy assignments_read_duo on public.goal_assignments for select to authenticated using(exists(select 1 from public.goals g where g.id=goal_id));
create policy assignments_create_manager on public.goal_assignments for insert to authenticated with check(private.can_manage_goal(goal_id));
create policy checkins_read_duo on public.goal_checkins for select to authenticated using(exists(select 1 from public.goals g where g.id=goal_id));
create policy checkins_create_self on public.goal_checkins for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.goals g where g.id=goal_id and private.is_duo_member(g.duo_id)));
create policy checkins_update_self on public.goal_checkins for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.goals g where g.id=goal_id)) with check(user_id=(select auth.uid()));
revoke all on public.goals,public.goal_assignments,public.goal_checkins from anon,authenticated;
grant select on public.goals,public.goal_assignments,public.goal_checkins to authenticated;
grant insert(duo_id,owner_user_id,scope,name,icon_key,tracking_type,measurement_kind,unit,created_by,notes) on public.goals to authenticated;
grant update(name,icon_key,status,notes) on public.goals to authenticated;
grant insert(goal_id,user_id,target_value,canonical_unit,active_from) on public.goal_assignments to authenticated;
grant insert(goal_id,user_id,local_date,value),update(value) on public.goal_checkins to authenticated;
revoke all on function public.replace_goal_assignment(uuid,uuid,numeric,date) from public,anon;
grant execute on function public.replace_goal_assignment(uuid,uuid,numeric,date) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_duo_member(uuid),private.valid_timezone(text),private.can_manage_goal(uuid) to authenticated;
