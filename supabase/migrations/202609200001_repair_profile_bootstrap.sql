-- A previous test-data reset truncated public.profiles but retained auth.users.
-- Restore the Auth insert hook and repair only missing rows. Existing profile
-- names and preferences must never be overwritten by this migration.
create or replace function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.create_profile();

revoke all on function private.create_profile() from public, anon, authenticated;

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
