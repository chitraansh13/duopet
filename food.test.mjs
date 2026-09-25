import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant usage on schema public to authenticated;
create schema extensions; set search_path=public,extensions;`);
for (const file of readdirSync('supabase/migrations').sort()) {
  try { await db.exec(readFileSync('supabase/migrations/'+file,'utf8')); }
  catch (error) { console.error(file,error.message); process.exit(1); }
}
const ids=[1,2,3,4].map(n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
for(const id of ids) await db.query('insert into auth.users(id) values($1)',[id]);
async function as(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[n]]);await db.exec('set role authenticated');}
async function one(sql,args=[]){return (await db.query(sql,args)).rows[0];}
async function reject(sql,args=[]){await assert.rejects(()=>db.query(sql,args));}
for(let n=0;n<4;n++){await as(n);await db.query('update profiles set display_name=$1 where id=$2',['User '+n,ids[n]]);}
await as(0);
const duo=(await one("select create_duo('Pair','Brownie','UTC') id")).id;
const code=(await one('select invite_code from duos')).invite_code;
await as(1);await db.query('select join_duo($1)',[code]);
await as(2);const other=(await one("select create_duo('Other','Brownie','UTC') id")).id;
await as(0);assert.equal((await one('select seed_default_goals() seeded')).seeded,true);
const rows=(await db.query("select name,target_direction,progress_source from goals where duo_id=$1 order by name",[duo])).rows;
assert.equal(rows.find(r=>r.name==='Calories').target_direction,'maximum');
assert.equal(rows.find(r=>r.name==='Calories').progress_source,'food_calories');
assert.equal(rows.find(r=>r.name==='Protein Intake').progress_source,'food_protein');
const food=(await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Test Paneer Wrap','1 wrap',400,25) returning *",[duo,ids[0]]));
await reject('insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,$3,$4,400,25)',[other,ids[0],'Wrong','1 wrap']);
assert.equal((await one("select count(*)::int n from foods where name ilike '%paneer%' and duo_id=$1",[duo])).n,1);
await as(1);assert.equal((await one('select count(*)::int n from foods where duo_id=$1',[duo])).n,1);
await as(2);assert.equal((await one('select count(*)::int n from foods where duo_id=$1',[duo])).n,0);
await reject('select save_food_log($1,1,null)',[food.id]);
await as(0);
const calorieId=(await one("select id from goals where duo_id=$1 and progress_source='food_calories'",[duo])).id;
const proteinId=(await one("select id from goals where duo_id=$1 and progress_source='food_protein'",[duo])).id;
await db.exec('reset role');
const today=(await one('select private.duo_today($1)::text as day',[duo])).day;
await as(0);
await reject('select set_goal_checkin($1,$2::date,9999)',[proteinId,today]);
await reject('insert into goal_checkins(goal_id,user_id,local_date,value) values($1,$2,$3::date,9999)',[proteinId,ids[0],today]);
await db.query('select set_my_goal_target($1,40,$2::date)',[proteinId,today]);
await db.query('select set_my_goal_target($1,700,$2::date)',[calorieId,today]);
let entry=await one('select * from save_food_log($1,2,null)',[food.id]);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).value),800);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[proteinId,ids[0]])).value),50);
assert.equal((await one('select completed from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).completed,false);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='goal_completion' and reversed_at is null and source_id=$1",[calorieId])).n,0);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='goal_completion' and reversed_at is null and source_id=$1",[proteinId])).n,1);
await db.query("update foods set calories_per_serving=450,protein_grams_per_serving=30,serving_description='1 revised wrap' where id=$1",[food.id]);
assert.equal(Number((await one('select calories_snapshot from food_log_entries where id=$1',[entry.id])).calories_snapshot),400);
entry=await one('select * from save_food_log($1,1.5,$2)',[food.id,entry.id]);
assert.equal(Number(entry.calories_snapshot),400);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).value),600);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[proteinId,ids[0]])).value),37.5);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_id=$1 and reversed_at is null",[proteinId])).n,0);
await db.query('select save_food_log($1,2,$2)',[food.id,entry.id]);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_id=$1",[proteinId])).n,1);
await as(1);assert.equal((await one('select count(*)::int n from food_log_entries')).n,1);
assert.equal((await one('select count(*)::int n from food_day_updates where user_id=$1',[ids[0]])).n,1);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).value),800);
assert.equal(Number((await one('select calories from get_food_totals($1,$2::date,$2::date)',[ids[0],today])).calories),800);
await reject('select * from get_food_totals($1,$2::date,$2::date+31)',[ids[0],today]);
assert.equal((await one('select count(*)::int n from food_log_entries where local_date=$1::date and user_id=$2',[today,ids[0]])).n,1);
await reject('select save_food_log($1,1,$2)',[food.id,entry.id]);
await reject('select delete_food_log($1)',[entry.id]);
await reject('update food_log_entries set quantity=10 where id=$1',[entry.id]);
assert.equal((await db.query("update foods set calories_per_serving=1 where id=$1",[food.id])).affectedRows,0);
await as(0);
assert.deepEqual((await one('select share_personal_goals,share_food_diary,share_nutrition_totals from sharing_preferences where user_id=$1',[ids[0]])),{share_personal_goals:true,share_food_diary:true,share_nutrition_totals:true});
await db.query('update sharing_preferences set share_food_diary=false where user_id=$1',[ids[0]]);
await as(1);
assert.equal((await one('select count(*)::int n from food_log_entries where user_id=$1',[ids[0]])).n,0);
assert.equal((await one('select count(*)::int n from food_day_updates where user_id=$1',[ids[0]])).n,1);
assert.equal(Number((await one('select calories from get_food_totals($1,$2::date,$2::date)',[ids[0],today])).calories),800);
await as(0);await db.query('update sharing_preferences set share_nutrition_totals=false where user_id=$1',[ids[0]]);
await as(1);
await reject('select * from get_food_totals($1,$2::date,$2::date)',[ids[0],today]);
assert.equal((await one('select count(*)::int n from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).n,0);
assert.equal((await one('select count(*)::int n from food_day_updates where user_id=$1',[ids[0]])).n,0);
await as(0);assert.equal((await one('select count(*)::int n from food_log_entries where user_id=$1',[ids[0]])).n,1);
await db.query('update sharing_preferences set share_food_diary=true where user_id=$1',[ids[0]]);
await as(1);assert.equal((await one('select count(*)::int n from food_log_entries where user_id=$1',[ids[0]])).n,1);
await as(2);assert.equal((await one('select count(*)::int n from food_log_entries where user_id=$1',[ids[0]])).n,0);
await reject('select * from get_food_totals($1,$2::date,$2::date)',[ids[0],today]);
await as(0);await db.query('select delete_food_log($1)',[entry.id]);
assert.equal(Number((await one('select value from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).value),0);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_id=$1 and reversed_at is null",[proteinId])).n,0);
await db.query("update foods set archived_at=now() where id=$1",[food.id]);
assert.equal((await one('select count(*)::int n from foods where archived_at is null')).n,0);
assert.equal((await one('select count(*)::int n from food_log_entries')).n,0);
await reject('select save_food_log($1,1,null)',[food.id]);
const overFood=await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Over test','1 wrap',450,0) returning id",[duo,ids[0]]);
await db.query('select save_food_log($1,2,null)',[overFood.id]);
assert.equal((await one('select completed from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).completed,false);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='perfect_day' and reversed_at is null")).n,0);

// Make the duo day advance without touching real time or production data.
await db.exec('reset role');
await db.exec("create or replace function private.duo_today(target_duo uuid) returns date language sql stable security definer set search_path='' as $$select current_date+1$$");
await as(0);
assert.equal((await one('select finalize_due_goal_days() n')).n,2);
assert.equal((await one('select finalize_due_goal_days() n')).n,0);
assert.equal((await one('select completed from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[0]])).completed,false);
assert.equal((await one('select completed from goal_checkins where goal_id=$1 and user_id=$2',[calorieId,ids[1]])).completed,true);
assert.equal((await one("select count(*)::int n from pet_xp_events where source_id=$1 and reversed_at is null and source_type='goal_completion'",[calorieId])).n,1);

// A duo with only a maximum goal cannot earn a perfect day while it is open.
await as(2);
const otherCode=(await one('select invite_code from duos where id=$1',[other])).invite_code;
await as(3);await db.query('select join_duo($1)',[otherCode]);
await as(2);await db.query('select seed_default_goals()');
await db.query("update goals set status='archived' where duo_id=$1 and progress_source<>'food_calories'",[other]);
assert.equal((await one("select count(*)::int n from pet_xp_events where duo_id=$1 and source_type='perfect_day' and reversed_at is null",[other])).n,0);
await db.exec('reset role');
await db.exec("create or replace function private.duo_today(target_duo uuid) returns date language sql stable security definer set search_path='' as $$select current_date+2$$");
await as(2);
assert.equal((await one('select finalize_due_goal_days() n')).n,2);
assert.equal((await one("select count(*)::int n from pet_xp_events where duo_id=$1 and source_type='perfect_day' and reversed_at is null",[other])).n,1);
assert.equal((await one('select finalize_due_goal_days() n')).n,0);
assert.equal((await one("select count(*)::int n from pet_xp_events where duo_id=$1 and source_type='perfect_day' and reversed_at is null",[other])).n,1);

// A scheduled target on a replaced starter remains scheduled on its new goal.
await as(0);
const targetRows=JSON.stringify([{user_id:ids[0],target:100},{user_id:ids[1],target:100}]);
const oldProtein=(await one("select create_directed_goal('Protein Intake','protein','shared','measured','number','g','custom',$1::jsonb,'minimum') id",[targetRows])).id;
await db.exec('reset role');
const future=(await one('select private.duo_today($1)::date + 1 as day',[duo])).day;
await as(0);
await db.query('select set_my_goal_target($1,120,$2::date)',[oldProtein,future]);
await db.query("update goals set status='archived' where id=$1",[oldProtein]);
const newProtein=(await one("select create_directed_goal('Protein Intake','protein','shared','measured','number','g','custom',$1::jsonb,'minimum') id",[targetRows])).id;
await db.exec('reset role');
await db.query("update goals set progress_source='food_protein' where id=$1",[newProtein]);
await db.exec(readFileSync('supabase/migrations/202609250002_preserve_food_target_schedules.sql','utf8'));
assert.equal(Number((await one('select target_value from goal_assignments where goal_id=$1 and user_id=$2 and active_from=$3::date',[newProtein,ids[0],future])).target_value),120);
await db.exec(readFileSync('supabase/migrations/202609250002_preserve_food_target_schedules.sql','utf8'));
assert.equal((await one('select count(*)::int n from goal_assignments where goal_id=$1 and user_id=$2 and active_from=$3::date',[newProtein,ids[0],future])).n,1);
await db.close();
console.log('Food catalog, private diary, snapshots, nutrition projections, XP reversal and maximum-day finalization passed (PGlite).');
