-- XP is still recorded by the existing idempotent ledger. Serialize the
-- entitlement projection so concurrent awards cannot miss a crossed threshold.
create or replace function private.on_xp_unlock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.duo_id::text,42));
  perform private.award_pet_unlocks(new.duo_id);
  return new;
end;
$$;
revoke all on function private.on_xp_unlock() from public,anon,authenticated;
