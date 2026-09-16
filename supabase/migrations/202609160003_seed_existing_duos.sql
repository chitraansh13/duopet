-- Seed already-paired hosted duos once. Future complete duos are covered by
-- seed_default_goals() during authenticated application bootstrap.
do $$
declare
  pair record;
  first_user uuid;
  second_user uuid;
  shared_targets jsonb;
begin
  for pair in
    select d.id as duo_id, d.created_by as actor
    from public.duos d
    where (select count(*) from public.duo_members m where m.duo_id = d.id) = 2
      and not exists(select 1 from public.goals g where g.duo_id = d.id)
    for update
  loop
    select user_id into first_user from public.duo_members where duo_id = pair.duo_id and slot = 1;
    select user_id into second_user from public.duo_members where duo_id = pair.duo_id and slot = 2;
    shared_targets := jsonb_build_array(jsonb_build_object('user_id',first_user),jsonb_build_object('user_id',second_user));
    perform private.insert_goal_definition(pair.duo_id,pair.actor,'Gym','gym','shared','boolean',null,null,'Any intentional gym session counts.',shared_targets);
    perform private.insert_goal_definition(pair.duo_id,pair.actor,'Study','study','shared','measured','duration','hrs','Focused study time, tracked independently.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',14400),jsonb_build_object('user_id',second_user,'target',10800)));
    perform private.insert_goal_definition(pair.duo_id,pair.actor,'Diet','calories','shared','measured','number','kcal','A daily calorie target for each person.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',2200),jsonb_build_object('user_id',second_user,'target',1700)));
    perform private.insert_goal_definition(pair.duo_id,pair.actor,'Protein Intake','protein','shared','measured','number','g','Different bodies, different targets—same shared category.',jsonb_build_array(jsonb_build_object('user_id',first_user,'target',150),jsonb_build_object('user_id',second_user,'target',95)));
    perform private.insert_goal_definition(pair.duo_id,pair.actor,'8K Steps','steps','shared','boolean',null,null,'Manually check this after reaching 8,000 steps.',shared_targets);
  end loop;
end;
$$;
