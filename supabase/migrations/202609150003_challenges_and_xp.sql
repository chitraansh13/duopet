-- Phase 1: challenge definitions and immutable final results; no mutable progress counters.
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id),
  linked_goal_id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 120),
  mode text not null check(mode in ('together','head_to_head')),
  metric text not null check(metric in ('completion_count','target_days','streak')),
  target integer not null check(target>0),
  start_date date not null,
  end_date date not null check(end_date>=start_date),
  reward text check(length(reward)<=300),
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(linked_goal_id,duo_id) references public.goals(id,duo_id),
  foreign key(duo_id,created_by) references public.duo_members(duo_id,user_id)
);
create index challenges_duo_status on public.challenges(duo_id,status);
create function private.validate_challenge() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.status<>'active' then raise exception 'FINALIZED_CHALLENGE'; end if;
  if tg_op='INSERT' and not exists(select 1 from public.goals where id=new.linked_goal_id and duo_id=new.duo_id and scope='shared' and status='active') then raise exception 'INVALID_CHALLENGE_GOAL'; end if;
  return new;
end;
$$;
create trigger challenges_validate before insert or update on public.challenges for each row execute function private.validate_challenge();
create trigger challenges_updated before update on public.challenges for each row execute function private.touch_updated_at();

-- Trusted finalizer writes this once, in the same transaction as status='completed'.
-- Per-participant result rows avoid `you`/`friend` columns and freeze final scores.
create table public.challenge_results (
  challenge_id uuid primary key references public.challenges(id),
  outcome text not null check(outcome in ('together_completed','together_missed','winner','tie')),
  winner_user_id uuid references public.profiles(id),
  shared_score integer not null check(shared_score>=0),
  calculation_version text not null,
  finalized_at timestamptz not null default now(),
  check((outcome='winner')=(winner_user_id is not null))
);
create table public.challenge_result_members (
  challenge_id uuid not null references public.challenge_results(challenge_id),
  user_id uuid not null references public.profiles(id),
  score integer not null check(score>=0),
  primary key(challenge_id,user_id)
);
create function private.immutable_result() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_RESULT'; end;
$$;
create trigger results_immutable before update or delete on public.challenge_results for each row execute function private.immutable_result();
create trigger result_members_immutable before update or delete on public.challenge_result_members for each row execute function private.immutable_result();

create table public.pet_xp_events (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id),
  actor_user_id uuid,
  source_type text not null check(source_type in ('goal_completion','duo_goal_completion','perfect_day')),
  source_id uuid not null,
  event_key text not null check(length(event_key) between 1 and 250),
  xp_amount integer not null check(xp_amount>0 and xp_amount<=100000),
  local_date date not null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique(duo_id,event_key),
  foreign key(duo_id,actor_user_id) references public.duo_members(duo_id,user_id),
  check(reversed_at is null or reversed_at>=created_at)
);
create index xp_duo_date on public.pet_xp_events(duo_id,local_date);
create function private.guard_xp_event() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE_XP_EVENT'; end if;
  if (new.id,new.duo_id,new.actor_user_id,new.source_type,new.source_id,new.event_key,new.xp_amount,new.local_date,new.created_at)
    is distinct from (old.id,old.duo_id,old.actor_user_id,old.source_type,old.source_id,old.event_key,old.xp_amount,old.local_date,old.created_at)
    then raise exception 'IMMUTABLE_XP_EVENT'; end if;
  return new; -- only reversed_at can change, including reactivation of this same unique event
end;
$$;
create trigger xp_events_immutable before update or delete on public.pet_xp_events for each row execute function private.guard_xp_event();

alter table public.challenges enable row level security;
alter table public.challenge_results enable row level security;
alter table public.challenge_result_members enable row level security;
alter table public.pet_xp_events enable row level security;
create policy challenges_read_duo on public.challenges for select to authenticated using(private.is_duo_member(duo_id));
create policy challenges_create_member on public.challenges for insert to authenticated with check(private.is_duo_member(duo_id) and created_by=(select auth.uid()) and status='active');
create policy challenges_edit_member on public.challenges for update to authenticated using(private.is_duo_member(duo_id) and status='active') with check(private.is_duo_member(duo_id));
create policy results_read_duo on public.challenge_results for select to authenticated using(exists(select 1 from public.challenges c where c.id=challenge_id));
create policy result_members_read_duo on public.challenge_result_members for select to authenticated using(exists(select 1 from public.challenges c where c.id=challenge_id));
create policy xp_read_duo on public.pet_xp_events for select to authenticated using(private.is_duo_member(duo_id));
revoke all on public.challenges,public.challenge_results,public.challenge_result_members,public.pet_xp_events from anon,authenticated;
grant select on public.challenges,public.challenge_results,public.challenge_result_members,public.pet_xp_events to authenticated;
grant insert(duo_id,linked_goal_id,name,mode,metric,target,start_date,end_date,reward,created_by) on public.challenges to authenticated;
grant update(name,reward) on public.challenges to authenticated;
-- No client grants/policies to mint XP, unlock rewards, or submit final scores.
grant all on public.profiles,public.duos,public.duo_members,public.duo_pets,public.pet_unlocks,public.pet_room_items,
 public.goals,public.goal_assignments,public.goal_checkins,public.challenges,public.challenge_results,public.challenge_result_members,public.pet_xp_events to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_duo_member(uuid),private.valid_timezone(text),private.can_manage_goal(uuid) to authenticated;

-- Enforce a complete, internally consistent finalization transaction even for trusted writers.
create function private.validate_final_result() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid; c public.challenges; r public.challenge_results; participants integer;
begin
  if tg_table_name='challenges' then cid=new.id; else cid=new.challenge_id; end if;
  select * into c from public.challenges where id=cid;
  select * into r from public.challenge_results where challenge_id=cid;
  if c.status='completed' then
    if r.challenge_id is null then raise exception 'RESULT_REQUIRED'; end if;
    if (c.mode='together') is distinct from (r.outcome in ('together_completed','together_missed')) then raise exception 'INVALID_OUTCOME'; end if;
    if r.winner_user_id is not null and not exists(select 1 from public.duo_members where duo_id=c.duo_id and user_id=r.winner_user_id) then raise exception 'INVALID_WINNER'; end if;
    select count(*) into participants from public.challenge_result_members where challenge_id=cid;
    if participants<>2 or exists(select 1 from public.challenge_result_members m where m.challenge_id=cid and not exists(select 1 from public.duo_members d where d.duo_id=c.duo_id and d.user_id=m.user_id)) then raise exception 'INVALID_RESULT_MEMBERS'; end if;
  elsif r.challenge_id is not null then raise exception 'CHALLENGE_NOT_COMPLETED'; end if;
  return null;
end;
$$;
create constraint trigger finalized_challenge_consistent after insert or update on public.challenges deferrable initially deferred for each row execute function private.validate_final_result();
create constraint trigger result_consistent after insert on public.challenge_results deferrable initially deferred for each row execute function private.validate_final_result();
create constraint trigger result_members_consistent after insert on public.challenge_result_members deferrable initially deferred for each row execute function private.validate_final_result();
revoke all on function private.validate_final_result() from public,anon,authenticated;
