-- Sharing is owned by each member. Existing accounts receive the same ON defaults
-- as new accounts; no goals, diary entries, or check-ins are changed.
create table public.sharing_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  share_personal_goals boolean not null default true,
  share_food_diary boolean not null default true,
  share_nutrition_totals boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.sharing_preferences(user_id)
select id from public.profiles on conflict (user_id) do nothing;
create trigger sharing_preferences_updated before update on public.sharing_preferences
  for each row execute function private.touch_updated_at();
create function private.create_sharing_preferences() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sharing_preferences(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger profile_sharing_defaults after insert on public.profiles
  for each row execute function private.create_sharing_preferences();

alter table public.sharing_preferences enable row level security;
create policy sharing_read_duo on public.sharing_preferences for select to authenticated
  using(user_id = (select auth.uid()) or exists(
    select 1 from public.duo_members mine join public.duo_members theirs on theirs.duo_id=mine.duo_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=sharing_preferences.user_id));
create policy sharing_update_self on public.sharing_preferences for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.sharing_preferences from anon,authenticated;
grant select on public.sharing_preferences to authenticated;
grant update(share_personal_goals,share_food_diary,share_nutrition_totals) on public.sharing_preferences to authenticated;
grant all on public.sharing_preferences to service_role;

-- SECURITY DEFINER avoids policy recursion while checking a partner's flag.
-- The caller must already belong to the owner's duo; a missing row fails closed.
create function private.partner_shares(p_owner uuid,p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case p_kind
    when 'personal' then s.share_personal_goals
    when 'diary' then s.share_food_diary
    when 'nutrition' then s.share_nutrition_totals
    else false end
    from public.sharing_preferences s
    join public.duo_members theirs on theirs.user_id=s.user_id
    join public.duo_members mine on mine.duo_id=theirs.duo_id
    where s.user_id=p_owner and mine.user_id=auth.uid()),false);
$$;
revoke all on function private.partner_shares(uuid,text) from public,anon,authenticated;
grant execute on function private.partner_shares(uuid,text) to authenticated;

drop policy goals_read_duo on public.goals;
create policy goals_read_shared_or_allowed_personal on public.goals for select to authenticated
  using(private.is_duo_member(duo_id) and (
    scope='shared' or owner_user_id=(select auth.uid())
    or private.partner_shares(owner_user_id,'personal')));
drop policy checkins_read_duo on public.goal_checkins;
create policy checkins_read_allowed on public.goal_checkins for select to authenticated
  using(exists(select 1 from public.goals g where g.id=goal_id)
    and (user_id=(select auth.uid()) or exists(
      select 1 from public.goals g where g.id=goal_id and
      (g.progress_source='manual' or private.partner_shares(user_id,'nutrition')))));
drop policy food_logs_read_self on public.food_log_entries;
create policy food_logs_read_allowed on public.food_log_entries for select to authenticated
  using(user_id=(select auth.uid()) or
    (private.is_duo_member(duo_id) and private.partner_shares(user_id,'diary')));

-- Status and XP rows can otherwise reveal a private goal's history by ID/date.
drop policy goal_status_read_duo on public.goal_status_events;
create policy goal_status_read_allowed on public.goal_status_events for select to authenticated
  using(exists(select 1 from public.goals g where g.id=goal_id));
drop policy xp_read_duo on public.pet_xp_events;
create policy xp_read_allowed on public.pet_xp_events for select to authenticated
  using(private.is_duo_member(duo_id) and (
    source_type not in ('goal_completion','duo_goal_completion') or
    exists(select 1 from public.goals g where g.id=source_id and
      (actor_user_id=(select auth.uid()) or
       (g.scope='shared' and (g.progress_source='manual' or private.partner_shares(actor_user_id,'nutrition'))) or
       (g.scope='personal' and private.partner_shares(g.owner_user_id,'personal') and
         (g.progress_source='manual' or private.partner_shares(actor_user_id,'nutrition')))))));
drop policy challenges_read_duo on public.challenges;
create policy challenges_read_allowed on public.challenges for select to authenticated
  using(private.is_duo_member(duo_id) and exists(select 1 from public.goals g where g.id=linked_goal_id
    and (g.progress_source='manual' or not exists(select 1 from public.duo_members m
      where m.duo_id=challenges.duo_id and m.user_id<>auth.uid()
      and not private.partner_shares(m.user_id,'nutrition')))));

-- Aggregate-only access when the detailed diary is private. Bound every call.
create function public.get_food_totals(p_user_id uuid,p_from date,p_to date)
returns table(local_date date,calories numeric,protein numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_from is null or p_to is null or p_to < p_from or p_to-p_from > 30
    or not exists(select 1 from public.duo_members mine join public.duo_members theirs on theirs.duo_id=mine.duo_id
      where mine.user_id=auth.uid() and theirs.user_id=p_user_id)
    or (p_user_id<>auth.uid() and not private.partner_shares(p_user_id,'nutrition'))
  then raise exception 'NOT_AUTHORIZED'; end if;
  return query select e.local_date,
    coalesce(sum(e.calories_snapshot*e.quantity),0),coalesce(sum(e.protein_snapshot*e.quantity),0)
    from public.food_log_entries e where e.user_id=p_user_id and e.local_date between p_from and p_to
    group by e.local_date order by e.local_date desc;
end;
$$;
revoke all on function public.get_food_totals(uuid,date,date) from public,anon;
grant execute on function public.get_food_totals(uuid,date,date) to authenticated;

-- A detail-free invalidation signal also works when diary details are private
-- but aggregate totals are shared. Clients cannot write these rows.
create table public.food_day_updates (
  user_id uuid not null,
  duo_id uuid not null,
  local_date date not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,local_date),
  foreign key(duo_id,user_id) references public.duo_members(duo_id,user_id)
);
insert into public.food_day_updates(user_id,duo_id,local_date,updated_at)
select user_id,duo_id,local_date,max(updated_at) from public.food_log_entries
group by user_id,duo_id,local_date on conflict (user_id,local_date) do nothing;
create function private.signal_food_day() returns trigger language plpgsql security definer set search_path='' as $$
declare row_user uuid; row_duo uuid; row_day date;
begin
  if tg_op='DELETE' then
    row_user:=old.user_id; row_duo:=old.duo_id; row_day:=old.local_date;
  else
    row_user:=new.user_id; row_duo:=new.duo_id; row_day:=new.local_date;
  end if;
  insert into public.food_day_updates(user_id,duo_id,local_date) values(row_user,row_duo,row_day)
  on conflict (user_id,local_date) do update set updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger food_day_signal after insert or update or delete on public.food_log_entries
  for each row execute function private.signal_food_day();
alter table public.food_day_updates enable row level security;
create policy food_day_updates_read_allowed on public.food_day_updates for select to authenticated
  using(user_id=auth.uid() or (private.is_duo_member(duo_id) and
    (private.partner_shares(user_id,'diary') or private.partner_shares(user_id,'nutrition'))));
revoke all on public.food_day_updates from anon,authenticated;
grant select on public.food_day_updates to authenticated;
grant all on public.food_day_updates to service_role;

-- Keep challenge score RPC from bypassing a revoked personal-goal share.
create or replace function public.get_challenge_scores(p_duo_id uuid)
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
    from public.challenges c join public.goals g on g.id=c.linked_goal_id
    join public.duo_members m on m.duo_id=c.duo_id
    left join public.challenge_results r on r.challenge_id=c.id
    left join public.challenge_result_members rm on rm.challenge_id=c.id and rm.user_id=m.user_id
    where c.duo_id=p_duo_id and c.status<>'cancelled'
      and (g.scope='shared' or g.owner_user_id=auth.uid() or private.partner_shares(g.owner_user_id,'personal'))
      and (g.progress_source='manual' or not exists(select 1 from public.duo_members other_member
        where other_member.duo_id=c.duo_id and other_member.user_id<>auth.uid()
        and not private.partner_shares(other_member.user_id,'nutrition')));
end;
$$;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sharing_preferences')
  then execute 'alter publication supabase_realtime add table public.sharing_preferences'; end if;
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='food_day_updates')
  then execute 'alter publication supabase_realtime add table public.food_day_updates'; end if;
end $$;
