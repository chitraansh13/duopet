-- Trigger-populated snapshot columns are intentionally absent from client
-- writes. This RPC gives generated clients an exact typed mutation boundary.
create function public.set_goal_checkin(p_goal_id uuid,p_local_date date,p_value numeric)
returns public.goal_checkins
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); saved public.goal_checkins;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(
    select 1
    from public.goals g
    join public.goal_assignments a on a.goal_id = g.id and a.user_id = uid
    where g.id = p_goal_id
      and g.status = 'active'
      and private.is_duo_member(g.duo_id)
      and p_local_date <= private.duo_today(g.duo_id)
      and a.active_from <= p_local_date
      and (a.active_until is null or p_local_date < a.active_until)
  ) then raise exception 'NOT_AUTHORIZED'; end if;
  insert into public.goal_checkins(goal_id,user_id,local_date,value)
    values(p_goal_id,uid,p_local_date,p_value)
    on conflict(goal_id,user_id,local_date) do update set value = excluded.value
    returning * into saved;
  return saved;
end;
$$;
revoke all on function public.set_goal_checkin(uuid,date,numeric) from public,anon;
grant execute on function public.set_goal_checkin(uuid,date,numeric) to authenticated;
