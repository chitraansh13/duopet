-- A challenge target must be attainable within its selected number of days.
create or replace function private.validate_challenge() returns trigger
language plpgsql security definer set search_path='' as $$
declare today date; duration integer; maximum integer;
begin
  if tg_op='UPDATE' then
    if old.status<>'active' then raise exception 'FINALIZED_CHALLENGE'; end if;
    return new;
  end if;
  if not exists(select 1 from public.goals where id=new.linked_goal_id and duo_id=new.duo_id
    and scope='shared' and status='active') then raise exception 'INVALID_CHALLENGE_GOAL'; end if;
  if (select count(*) from public.duo_members where duo_id=new.duo_id)<>2 then raise exception 'DUO_INCOMPLETE'; end if;
  today := private.duo_today(new.duo_id);
  duration := new.end_date-new.start_date+1;
  if new.start_date<today or duration<1 or duration>90 then raise exception 'INVALID_CHALLENGE_DATES'; end if;
  maximum := duration * case when new.mode='together' and new.metric='completion_count' then 2 else 1 end;
  if new.target<1 or new.target>maximum then raise exception 'INVALID_CHALLENGE_TARGET'; end if;
  return new;
end;
$$;
revoke all on function private.validate_challenge() from public,anon,authenticated;
