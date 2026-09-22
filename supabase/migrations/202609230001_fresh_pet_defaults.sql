-- New duos begin with Brownie's actual Level-1 defaults. Existing duo rows are
-- deliberately untouched; the frontend applies real level requirements to any
-- legacy catalog seed.
create or replace function public.create_duo(p_display_name text, p_brownie_name text, p_timezone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists(select 1 from public.duo_members where user_id = uid) then raise exception 'ALREADY_PAIRED'; end if;
  if not exists(select 1 from public.profiles where id = uid and length(btrim(display_name)) > 0) then raise exception 'PROFILE_REQUIRED'; end if;
  if not private.valid_timezone(p_timezone) or p_timezone is null then raise exception 'INVALID_TIMEZONE'; end if;
  if length(coalesce(p_display_name,'')) > 80 or length(coalesce(p_brownie_name,'')) > 40 then raise exception 'INVALID_INPUT'; end if;

  insert into public.duos(display_name,timezone,created_by)
    values(nullif(btrim(p_display_name),''),p_timezone,uid) returning id into new_id;
  insert into public.duo_members(duo_id,user_id,slot) values(new_id,uid,1);
  insert into public.duo_pets(duo_id,name,equipped_accessory_id)
    values(new_id,coalesce(nullif(btrim(p_brownie_name),''),'Brownie'),'basic-collar');
  insert into public.pet_unlocks(duo_id,item_kind,item_id) values
    (new_id,'accessory','basic-collar'),
    (new_id,'accessory','none'),
    (new_id,'room','cozy-bed');
  insert into public.pet_room_items(duo_id,item_id) values(new_id,'cozy-bed');
  return new_id;
end;
$$;

revoke all on function public.create_duo(text,text,text) from public,anon;
grant execute on function public.create_duo(text,text,text) to authenticated;
