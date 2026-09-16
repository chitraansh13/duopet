-- Phase 1: private profiles, two-person duos, transactional pairing.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create function private.valid_timezone(value text) returns boolean language sql stable set search_path = '' as $$
  select (value = 'UTC' or (value like '%/%' and value not like 'posix/%' and value not like 'right/%'))
    and exists (select 1 from pg_catalog.pg_timezone_names where name = value);
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  nickname text check (length(nickname) <= 80),
  avatar_url text check (length(avatar_url) <= 2048),
  initials text check (length(initials) <= 6),
  brownie_encouragement boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values(new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();
-- Also supports applying this migration to a project with existing auth users.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create table public.duos (
  id uuid primary key default gen_random_uuid(),
  display_name text check (length(display_name) <= 80),
  timezone text not null check (private.valid_timezone(timezone)),
  invite_code text not null unique default upper(encode(extensions.gen_random_bytes(16), 'hex'))
    check (invite_code ~ '^[0-9A-F]{32}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger duos_updated before update on public.duos for each row execute function private.touch_updated_at();

create table public.duo_members (
  duo_id uuid not null references public.duos(id),
  user_id uuid primary key references public.profiles(id), -- one active duo per user
  slot smallint not null check (slot in (1,2)),
  joined_at timestamptz not null default now(),
  unique (duo_id,user_id),
  unique (duo_id,slot) -- only two possible slots, even under concurrent writes
);

create function private.is_duo_member(target_duo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.duo_members where duo_id = target_duo and user_id = (select auth.uid()));
$$;
create function private.duo_today(target_duo uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone timezone)::date from public.duos where id = target_duo;
$$;

-- Brownie's name has one source of truth, here, rather than duplicating it in duos.
create table public.duo_pets (
  duo_id uuid primary key references public.duos(id),
  name text not null default 'Brownie' check (length(btrim(name)) between 1 and 40),
  equipped_accessory_id text check (length(equipped_accessory_id) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pets_updated before update on public.duo_pets for each row execute function private.touch_updated_at();
create table public.pet_unlocks (
  duo_id uuid not null references public.duo_pets(duo_id),
  item_kind text not null check (item_kind in ('accessory','room')),
  item_id text not null check (length(item_id) between 1 and 80),
  unlocked_at timestamptz not null default now(),
  primary key(duo_id,item_kind,item_id)
);
create table public.pet_room_items (
  duo_id uuid not null references public.duo_pets(duo_id),
  item_id text not null check (length(item_id) between 1 and 80),
  primary key(duo_id,item_id)
);

create function public.create_duo(p_display_name text, p_brownie_name text, p_timezone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists(select 1 from public.duo_members where user_id = uid) then raise exception 'ALREADY_PAIRED'; end if;
  if not exists(select 1 from public.profiles where id = uid and length(btrim(display_name)) > 0) then raise exception 'PROFILE_REQUIRED'; end if;
  if not private.valid_timezone(p_timezone) or p_timezone is null then raise exception 'INVALID_TIMEZONE'; end if;
  if length(coalesce(p_display_name,'')) > 80 or length(coalesce(p_brownie_name,'')) > 40 then raise exception 'INVALID_INPUT'; end if;
  insert into public.duos(display_name,timezone,created_by) values(nullif(btrim(p_display_name),''),p_timezone,uid) returning id into new_id;
  insert into public.duo_members(duo_id,user_id,slot) values(new_id,uid,1);
  insert into public.duo_pets(duo_id,name,equipped_accessory_id) values(new_id,coalesce(nullif(btrim(p_brownie_name),''),'Brownie'),'basic-collar');
  insert into public.pet_unlocks(duo_id,item_kind,item_id) values
    (new_id,'accessory','basic-collar'), (new_id,'accessory','none'),
    (new_id,'room','cozy-bed'), (new_id,'room','tennis-ball');
  insert into public.pet_room_items(duo_id,item_id) values(new_id,'cozy-bed'),(new_id,'tennis-ball');
  return new_id;
end;
$$;

create function public.join_duo(p_invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid; code text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists(select 1 from public.duo_members where user_id = uid) then raise exception 'ALREADY_PAIRED'; end if;
  if not exists(select 1 from public.profiles where id = uid and length(btrim(display_name)) > 0) then raise exception 'PROFILE_REQUIRED'; end if;
  code := upper(regexp_replace(coalesce(p_invite_code,''),'[[:space:]-]','','g'));
  if code !~ '^[0-9A-F]{32}$' then raise exception 'INVALID_INVITE'; end if;
  select id into target from public.duos where invite_code = code for update;
  if target is null then raise exception 'INVALID_INVITE'; end if;
  if (select count(*) from public.duo_members where duo_id = target) >= 2 then raise exception 'DUO_FULL'; end if;
  insert into public.duo_members(duo_id,user_id,slot) values(target,uid,2);
  return target;
end;
$$;

-- Intentionally limited partner profile projection. Raw profiles remain own-user only.
create function public.get_duo_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('duo',to_jsonb(d),'pet',to_jsonb(p),'members',(
    select jsonb_agg(jsonb_build_object('user_id',m.user_id,'joined_at',m.joined_at,
      'display_name',pr.display_name,'initials',pr.initials,'avatar_url',pr.avatar_url) order by m.slot)
    from public.duo_members m join public.profiles pr on pr.id = m.user_id where m.duo_id = d.id
  )) from public.duos d join public.duo_members me on me.duo_id=d.id and me.user_id=(select auth.uid())
    join public.duo_pets p on p.duo_id=d.id;
$$;

alter table public.profiles enable row level security;
alter table public.duos enable row level security;
alter table public.duo_members enable row level security;
alter table public.duo_pets enable row level security;
alter table public.pet_unlocks enable row level security;
alter table public.pet_room_items enable row level security;
create policy profiles_read_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy duos_read_member on public.duos for select to authenticated using(private.is_duo_member(id));
create policy duos_update_member on public.duos for update to authenticated using(private.is_duo_member(id)) with check(private.is_duo_member(id));
create policy members_read_duo on public.duo_members for select to authenticated using(private.is_duo_member(duo_id));
create policy pets_read_member on public.duo_pets for select to authenticated using(private.is_duo_member(duo_id));
create policy pets_update_member on public.duo_pets for update to authenticated using(private.is_duo_member(duo_id)) with check(private.is_duo_member(duo_id));
create policy unlocks_read_member on public.pet_unlocks for select to authenticated using(private.is_duo_member(duo_id));
create policy room_read_member on public.pet_room_items for select to authenticated using(private.is_duo_member(duo_id));
create policy room_select_unlocked on public.pet_room_items for insert to authenticated with check(private.is_duo_member(duo_id) and exists(select 1 from public.pet_unlocks u where u.duo_id=pet_room_items.duo_id and u.item_kind='room' and u.item_id=pet_room_items.item_id));
create policy room_remove_member on public.pet_room_items for delete to authenticated using(private.is_duo_member(duo_id));

create function private.validate_accessory() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.equipped_accessory_id is not null and not exists(select 1 from public.pet_unlocks where duo_id=new.duo_id and item_kind='accessory' and item_id=new.equipped_accessory_id) then raise exception 'ACCESSORY_LOCKED'; end if;
  return new;
end;
$$;
create trigger accessory_unlocked before update of equipped_accessory_id on public.duo_pets for each row execute function private.validate_accessory();

revoke all on public.profiles,public.duos,public.duo_members,public.duo_pets,public.pet_unlocks,public.pet_room_items from anon,authenticated;
grant select on public.profiles,public.duos,public.duo_members,public.duo_pets,public.pet_unlocks,public.pet_room_items to authenticated;
grant update(display_name,nickname,avatar_url,initials,brownie_encouragement) on public.profiles to authenticated;
grant update(display_name) on public.duos to authenticated; -- timezone/invite/creator cannot be changed by clients
grant update(name,equipped_accessory_id) on public.duo_pets to authenticated;
grant insert(duo_id,item_id),delete on public.pet_room_items to authenticated;
revoke all on function public.create_duo(text,text,text),public.join_duo(text),public.get_duo_context() from public,anon;
grant execute on function public.create_duo(text,text,text),public.join_duo(text),public.get_duo_context() to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_duo_member(uuid),private.valid_timezone(text) to authenticated;
