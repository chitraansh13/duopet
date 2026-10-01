-- Recent-day corrections. No historical data is rewritten by this migration.
-- Midnight is resolved in the duo IANA zone first; then add 36 elapsed hours.
create function private.day_edit_deadline(p_duo_id uuid,p_day date) returns timestamptz
language sql stable security definer set search_path='' as $$
  select ((p_day+1)::timestamp at time zone d.timezone)+interval '36 hours'
  from public.duos d where d.id=p_duo_id;
$$;
create function private.day_is_editable(p_duo_id uuid,p_day date,p_at timestamptz default now()) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(p_day<=private.duo_today(p_duo_id) and p_at<private.day_edit_deadline(p_duo_id,p_day),false);
$$;
revoke all on function private.day_edit_deadline(uuid,date),private.day_is_editable(uuid,date,timestamptz) from public,anon,authenticated;

-- Return server-authoritative quick-edit dates; clients never submit a clock.
create function public.get_editable_days()
returns table(local_date date,editable_until timestamptz,is_today boolean,server_now timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare target_duo uuid; today date;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.duo_id into target_duo from public.duo_members m where m.user_id=auth.uid();
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  today:=private.duo_today(target_duo);
  return query select today-n,private.day_edit_deadline(target_duo,today-n),n=0,now()
    from generate_series(0,2) n where private.day_is_editable(target_duo,today-n) order by n;
end;
$$;
revoke all on function public.get_editable_days() from public,anon;
grant execute on function public.get_editable_days() to authenticated;

-- Value/input may change within grace; original targets/rules/close timestamps stay pinned.
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
    if new.logged_required_snapshot is distinct from old.logged_required_snapshot or new.has_food_log is distinct from old.has_food_log then raise exception 'IMMUTABLE_INPUT_RULE'; end if;
    if old.finalized_at is not null and (new.target_snapshot,new.finalized_at) is distinct from (old.target_snapshot,old.finalized_at)
      then raise exception 'DAY_ALREADY_CLOSED'; end if;
    if (new.assignment_id,new.target_snapshot) is distinct from (old.assignment_id,old.target_snapshot) then
      if new.user_id is distinct from auth.uid() or new.local_date <> private.duo_today(goal.duo_id)
        or new.assignment_id is distinct from assignment.id or new.target_snapshot is distinct from assignment.target_value
      then raise exception 'IMMUTABLE_SNAPSHOT'; end if;
    end if;
    if new.finalized_at is distinct from old.finalized_at and new.local_date >= private.duo_today(goal.duo_id)
      then raise exception 'DAY_STILL_OPEN'; end if;
  end if;
  if tg_op='INSERT' or old.finalized_at is null or (new.user_id=auth.uid() and private.day_is_editable(goal.duo_id,new.local_date)) then
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
  if tg_op='UPDATE' and old.finalized_at is not null and (new.value,new.has_food_log) is distinct from (old.value,old.has_food_log)
    and (new.user_id is distinct from auth.uid() or not private.day_is_editable(goal.duo_id,new.local_date)) then raise exception 'EDITING_WINDOW_CLOSED'; end if;
  if new.finalized_at is not null and new.local_date >= private.duo_today(goal.duo_id) then raise exception 'DAY_STILL_OPEN'; end if;
  return new;
end;
$$;

create or replace function public.set_goal_checkin(p_goal_id uuid,p_local_date date,p_value numeric)
returns public.goal_checkins language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); goal public.goals; saved public.goal_checkins;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into goal from public.goals where id=p_goal_id;
  if goal.id is null or goal.progress_source<>'manual' or not private.is_duo_member(goal.duo_id)
    or not exists(select 1 from public.goal_assignments a where a.goal_id=p_goal_id and a.user_id=uid
      and a.active_from<=p_local_date and (a.active_until is null or p_local_date<a.active_until))
    or (select s.status from public.goal_status_events s where s.goal_id=p_goal_id and s.effective_date<=p_local_date order by s.effective_date desc limit 1) is distinct from 'active'
  then raise exception 'NOT_AUTHORIZED'; end if;
  perform 1 from public.duos where id=goal.duo_id for update;
  if not private.day_is_editable(goal.duo_id,p_local_date) then raise exception 'EDITING_WINDOW_CLOSED'; end if;
  insert into public.goal_checkins(goal_id,user_id,local_date,value,finalized_at)
    values(p_goal_id,uid,p_local_date,p_value,case when p_local_date<private.duo_today(goal.duo_id) then now() end)
    on conflict(goal_id,user_id,local_date) do update set value=excluded.value,
      finalized_at=coalesce(public.goal_checkins.finalized_at,excluded.finalized_at) returning * into saved;
  perform private.reconcile_challenges_for_day(goal.duo_id,p_local_date);
  return saved;
end;
$$;

-- Historical applicability, same canonical food aggregation and completion/XP triggers.
create or replace function private.sync_food_goals(p_duo_id uuid,p_user_id uuid,p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare goal record; total numeric;
begin
  for goal in
    select g.id,g.progress_source from public.goals g
    join public.goal_assignments a on a.goal_id=g.id and a.user_id=p_user_id
      and a.active_from<=p_day and (a.active_until is null or p_day<a.active_until)
    where g.duo_id=p_duo_id and (select s.status from public.goal_status_events s where s.goal_id=g.id and s.effective_date<=p_day order by s.effective_date desc limit 1)='active' and g.progress_source in ('food_calories','food_protein')
  loop
    select coalesce(sum(case when goal.progress_source='food_calories'
      then e.calories_snapshot else e.protein_snapshot end * e.quantity),0)
      into total from public.food_log_entries e where e.duo_id=p_duo_id and e.user_id=p_user_id and e.local_date=p_day;
    insert into public.goal_checkins(goal_id,user_id,local_date,value,finalized_at)
      values(goal.id,p_user_id,p_day,total,case when p_day<private.duo_today(p_duo_id) then now() end)
      on conflict(goal_id,user_id,local_date) do update set value=excluded.value,finalized_at=coalesce(public.goal_checkins.finalized_at,excluded.finalized_at);
  end loop;
  perform private.reconcile_challenges_for_day(p_duo_id,p_day);
end;
$$;

-- Extend the existing named RPC without an ambiguous REST overload.
-- Calls omitting p_local_date remain compatible and log today (or edit the entry's date).
drop function public.save_food_log(uuid,numeric,uuid);
create or replace function public.save_food_log(p_food_id uuid,p_quantity numeric,p_entry_id uuid default null,p_local_date date default null)
returns public.food_log_entries language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); food public.foods; previous public.food_log_entries; saved public.food_log_entries; day date;
begin
  if uid is null or p_quantity is null or p_quantity <= 0 or p_quantity > 100 or p_quantity >= 'Infinity'::numeric
    then raise exception 'INVALID_QUANTITY'; end if;
  select * into food from public.foods where id=p_food_id;
  if food.id is null or not private.is_duo_member(food.duo_id) then raise exception 'FOOD_UNAVAILABLE'; end if;
  perform 1 from public.duos where id=food.duo_id for update;
  day := coalesce(p_local_date,private.duo_today(food.duo_id));
  if p_entry_id is null then
    if not private.day_is_editable(food.duo_id,day) then raise exception 'EDITING_WINDOW_CLOSED'; end if;
    if food.archived_at is not null then raise exception 'FOOD_UNAVAILABLE'; end if;
    insert into public.food_log_entries(duo_id,user_id,food_id,local_date,quantity,calories_snapshot,protein_snapshot,serving_snapshot,food_name_snapshot)
      values(food.duo_id,uid,food.id,day,p_quantity,food.calories_per_serving,food.protein_grams_per_serving,food.serving_description,food.name)
      returning * into saved;
  else
    select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid for update;
    if previous.id is null or previous.duo_id<>food.duo_id or previous.food_id<>food.id or (p_local_date is not null and previous.local_date<>p_local_date)
      then raise exception 'LOG_UNAVAILABLE'; end if;
    day:=previous.local_date;
    if not private.day_is_editable(food.duo_id,day) then raise exception 'EDITING_WINDOW_CLOSED'; end if;
    update public.food_log_entries set quantity=p_quantity where id=p_entry_id returning * into saved;
  end if;
  perform private.sync_food_goals(food.duo_id,uid,day);
  return saved;
end;
$$;
revoke all on function public.save_food_log(uuid,numeric,uuid,date) from public,anon;
grant execute on function public.save_food_log(uuid,numeric,uuid,date) to authenticated;

create or replace function public.delete_food_log(p_entry_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); previous public.food_log_entries;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid;
  if previous.id is null or not private.is_duo_member(previous.duo_id) then raise exception 'LOG_UNAVAILABLE'; end if;
  perform 1 from public.duos where id=previous.duo_id for update;
  select * into previous from public.food_log_entries where id=p_entry_id and user_id=uid for update;
  if previous.id is null or not private.is_duo_member(previous.duo_id) then raise exception 'LOG_UNAVAILABLE'; end if;
  if not private.day_is_editable(previous.duo_id,previous.local_date) then raise exception 'EDITING_WINDOW_CLOSED'; end if;
  delete from public.food_log_entries where id=p_entry_id;
  perform private.sync_food_goals(previous.duo_id,uid,previous.local_date);
  return true;
end;
$$;

-- Backfilled input records that logical date; original mutation timestamps remain real.
create or replace function private.record_user_activity() returns trigger
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
  if target_duo is null or not private.day_is_editable(target_duo,new.local_date) then return new; end if;
  insert into public.user_activity_days(duo_id,user_id,local_date) values(target_duo,new.user_id,new.local_date)
    on conflict do nothing;
  return new;
end;
$$;

create function private.finalize_challenge(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.challenges; member_a uuid; member_b uuid; score_a integer; score_b integer; shared integer; result text; winner uuid;
begin
  select * into c from public.challenges where id=p_id for update;
  if c.id is null or c.status='cancelled' or c.end_date>=private.duo_today(c.duo_id) then return; end if;
  if c.status='completed' and not private.day_is_editable(c.duo_id,c.end_date) then return; end if;
    select user_id into member_a from public.duo_members where duo_id=c.duo_id and slot=1;
    select user_id into member_b from public.duo_members where duo_id=c.duo_id and slot=2;
    if member_a is null or member_b is null then return; end if;
    score_a := private.challenge_score(c.id,member_a,c.end_date);
    score_b := private.challenge_score(c.id,member_b,c.end_date);
    shared := private.challenge_score(c.id,null,c.end_date);
    if c.mode='together' then
      result := case when shared>=c.target then 'together_completed' else 'together_missed' end;
    elsif score_a=score_b then result := 'tie';
    else result := 'winner'; winner := case when score_a>score_b then member_a else member_b end;
    end if;
    insert into public.challenge_results(challenge_id,outcome,winner_user_id,shared_score,calculation_version)
      values(c.id,result,winner,shared,'checkins-v1')
      on conflict(challenge_id) do update set outcome=excluded.outcome,winner_user_id=excluded.winner_user_id,
        shared_score=excluded.shared_score,finalized_at=now()
      where (public.challenge_results.outcome,public.challenge_results.winner_user_id,public.challenge_results.shared_score)
        is distinct from (excluded.outcome,excluded.winner_user_id,excluded.shared_score);
    insert into public.challenge_result_members(challenge_id,user_id,score)
      values(c.id,member_a,score_a),(c.id,member_b,score_b)
      on conflict(challenge_id,user_id) do update set score=excluded.score
      where public.challenge_result_members.score<>excluded.score;
    if c.status='active' then update public.challenges set status='completed' where id=c.id; end if;

end;
$$;
create function private.reconcile_challenges_for_day(p_duo_id uuid,p_day date) returns void
language plpgsql security definer set search_path='' as $$
declare item record;
begin
  for item in select c.id from public.challenges c where c.duo_id=p_duo_id and c.status='completed'
    and p_day between c.start_date and c.end_date and private.day_is_editable(c.duo_id,c.end_date)
  loop perform private.finalize_challenge(item.id); end loop;
end;
$$;
revoke all on function private.finalize_challenge(uuid),private.reconcile_challenges_for_day(uuid,date) from public,anon,authenticated;

create or replace function public.finalize_due_challenges() returns integer
language plpgsql security definer set search_path='' as $$
declare target_duo uuid; item record; n integer:=0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.duo_id into target_duo from public.duo_members m where m.user_id=auth.uid();
  if target_duo is null then raise exception 'DUO_REQUIRED'; end if;
  perform 1 from public.duos where id=target_duo for update;
  for item in select c.id from public.challenges c where c.duo_id=target_duo and c.status='active'
    and c.end_date<private.duo_today(target_duo)
  loop perform private.finalize_challenge(item.id); n:=n+1; end loop;
  return n;
end;
$$;

-- No direct client result writes exist. Only the trusted owner may revise a result,
-- only while its last contributing date remains editable. Identity stays fixed.
create or replace function private.immutable_result() returns trigger
language plpgsql set search_path='' as $$
declare c public.challenges;
begin
  if tg_op<>'UPDATE' or new.challenge_id<>old.challenge_id
    or current_user<>(select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class where oid=tg_relid)
    then raise exception 'IMMUTABLE_RESULT'; end if;
  if tg_table_name='challenge_result_members' then
    if new.user_id<>old.user_id then raise exception 'IMMUTABLE_RESULT'; end if;
  end if;
  select * into c from public.challenges where id=old.challenge_id;
  if not private.day_is_editable(c.duo_id,c.end_date) then raise exception 'IMMUTABLE_RESULT'; end if;
  return new;
end;
$$;
revoke all on function private.immutable_result() from public,anon,authenticated;

-- Legacy 5/10 tiers can change after a deliberate eligible correction, using the
-- same event row/key. Frozen historical XP and all event identity stay immutable.
create or replace function private.guard_xp_event() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE_XP_EVENT'; end if;
  if (new.id,new.duo_id,new.actor_user_id,new.source_type,new.source_id,new.event_key,new.local_date,new.created_at)
    is distinct from (old.id,old.duo_id,old.actor_user_id,old.source_type,old.source_id,old.event_key,old.local_date,old.created_at)
    then raise exception 'IMMUTABLE_XP_EVENT'; end if;
  if new.xp_amount<>old.xp_amount and (old.source_type<>'goal_completion' or new.xp_amount not in (5,10)
    or current_user<>(select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class where oid=tg_relid)
    or not private.day_is_editable(old.duo_id,old.local_date)) then raise exception 'IMMUTABLE_XP_EVENT'; end if;
  return new;
end;
$$;
revoke all on function private.guard_xp_event() from public,anon,authenticated;

create or replace function private.set_xp_event(
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
      on conflict(duo_id,event_key) do update set reversed_at = null,
        xp_amount=case when private.day_is_editable(p_duo_id,p_local_date) and p_source_type='goal_completion'
          then excluded.xp_amount else public.pet_xp_events.xp_amount end;
  else
    update public.pet_xp_events set reversed_at = coalesce(reversed_at,now())
      where duo_id = p_duo_id and event_key = p_event_key and reversed_at is null;
  end if;
end;
$$;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='challenge_results') then
    execute 'alter publication supabase_realtime add table public.challenge_results';
  end if;
end $$;
