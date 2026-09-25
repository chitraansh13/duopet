-- The initial Food conversion preserved today's targets. Carry an already
-- scheduled future version from an archived manual starter to its replacement.
-- Match only the unique old/new pair created in the same conversion moment;
-- leave ambiguous/custom configurations untouched for manual review.
do $$
declare link record; planned public.goal_assignments; current_row public.goal_assignments; today date;
begin
  for link in
    select * from (
      select n.id as new_id,o.id as old_id,n.duo_id,
        count(*) over(partition by n.id) as matches
      from public.goals n join public.goals o on o.duo_id=n.duo_id
        and o.id<>n.id and o.icon_key=n.icon_key and o.unit=n.unit
        and o.progress_source='manual' and o.status='archived' and o.archived_at is not null
        and abs(extract(epoch from n.created_at-o.archived_at))<60
      where n.progress_source in ('food_calories','food_protein')
    ) candidates where matches=1
  loop
    today := private.duo_today(link.duo_id);
    for planned in select * from public.goal_assignments
      where goal_id=link.old_id and active_from>today order by user_id,active_from
    loop
      if exists(select 1 from public.goal_assignments where goal_id=link.new_id
        and user_id=planned.user_id and active_from=planned.active_from) then continue; end if;
      select * into current_row from public.goal_assignments
        where goal_id=link.new_id and user_id=planned.user_id
          and active_from<planned.active_from
          and (active_until is null or planned.active_from<active_until)
        order by active_from desc limit 1 for update;
      if current_row.id is null then continue; end if;
      update public.goal_assignments set active_until=planned.active_from where id=current_row.id;
      insert into public.goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from,active_until)
        values(link.new_id,planned.user_id,planned.target_value,planned.canonical_unit,planned.active_from,planned.active_until);
    end loop;
  end loop;
end;
$$;
