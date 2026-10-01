import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
process.on('uncaughtException',error=>{console.error(error.message,error.query??'',error.where??'');process.exit(1);});

const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8').replaceAll('"@/lib/','"./'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {dayStillEditable,dayLabel}=require('./lib/backfill.ts');
const {mergeCheckIn,goalStateFromRows}=require('./lib/repositories/goal-adapters.ts');
const deadline={local_date:'2026-09-30',editable_until:'2026-10-02T06:30:00Z',server_now:'2026-10-02T06:29:00Z',is_today:false};
assert.equal(dayStillEditable(deadline,59_999),true);
assert.equal(dayStillEditable(deadline,60_000),false);
assert.equal(dayLabel('2026-10-02','2026-10-02'),'Today');
assert.equal(dayLabel('2026-10-01','2026-10-02'),'Yesterday');
assert.equal(dayLabel('2026-09-30','2026-10-02'),'Sep 30');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8').replaceAll('"@/',`"${process.cwd().replaceAll('\\','/')}/`),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {EditableDaySelector}=require('./components/EditableDaySelector.tsx');
const window={date:'2026-09-30',today:'2026-10-02',days:[deadline],editable:true,loading:false,deadline:deadline.editable_until,refresh:async()=>{}};
const selector=renderToStaticMarkup(React.createElement(EditableDaySelector,{window,timezone:'Asia/Kolkata',onChange:()=>{}}));
assert.ok(selector.includes('Editing Sep 30')&&selector.includes('Oct 2, 12:00 PM'));
const closed=renderToStaticMarkup(React.createElement(EditableDaySelector,{window:{...window,days:[],editable:false},timezone:'Asia/Kolkata',onChange:()=>{}}));
assert.ok(closed.includes('Editing window closed')&&closed.includes('value="2026-09-30"'));

const db=new PGlite({extensions:{btree_gist,pgcrypto}});
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated; create schema extensions; set search_path=public,extensions; set timezone='UTC';`);
for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
const ids=[1,2,3].map(n=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
async function one(sql,args=[]){return(await db.query(sql,args)).rows[0];}
async function owner(sql,args=[]){await db.exec('reset role');return one(sql,args);}
async function as(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[n]]);await db.exec('set role authenticated');}
async function reject(sql,args=[],code){await assert.rejects(()=>db.query(sql,args),code?new RegExp(code):undefined);}
async function clock(at){await owner('update private.test_clock set at=$1::timestamptz',[at]);}
for(let n=0;n<3;n++){await as(n);await db.query("update profiles set display_name='Test' where id=$1",[ids[n]]);}
await as(0);const duo=(await one("select create_duo('Pair','Brownie','Asia/Kolkata') id")).id;
const invite=(await one('select invite_code from duos')).invite_code;
await as(1);await one('select join_duo($1)',[invite]);await as(2);const other=(await one("select create_duo('Other','Brownie','America/New_York') id")).id;
await db.exec('reset role');
await db.exec(`create table private.test_clock(at timestamptz); insert into private.test_clock values('2026-09-29T06:00:00Z')`);
await db.exec(`create or replace function private.duo_today(target_duo uuid) returns date language sql stable security definer set search_path='' as $$
select (t.at at time zone d.timezone)::date from private.test_clock t,public.duos d where d.id=target_duo$$;
alter table public.goals alter column created_at set default '2026-09-29T06:00:00Z'::timestamptz;`);
await clock('2026-10-02T06:29:00Z');
assert.equal((await one("select private.day_edit_deadline($1,'2026-09-30')::text deadline",[duo])).deadline,'2026-10-02 06:30:00+00');
assert.equal((await one("select private.day_is_editable($1,'2026-09-30','2026-10-02T06:29:00Z') ok",[duo])).ok,true);
assert.equal((await one("select private.day_is_editable($1,'2026-09-30','2026-10-02T06:30:00Z') ok",[duo])).ok,false);
// Next midnight is timezone-resolved before adding elapsed hours (DST fall/spring).
assert.equal((await one("select private.day_edit_deadline($1,'2026-10-31')::text deadline",[other])).deadline,'2026-11-02 16:00:00+00');
assert.equal((await one("select private.day_edit_deadline($1,'2026-03-07')::text deadline",[other])).deadline,'2026-03-09 17:00:00+00');
// The same gate, with only its clock default replaced in this disposable database.
await db.exec(`create or replace function private.day_is_editable(p_duo_id uuid,p_day date,p_at timestamptz default null) returns boolean
language sql stable security definer set search_path='' as $$
select coalesce(p_day<=private.duo_today(p_duo_id) and coalesce(p_at,(select at from private.test_clock))<private.day_edit_deadline(p_duo_id,p_day),false)$$;`);
await clock('2026-09-29T06:00:00Z');await as(0);await one('select seed_default_goals()');
const gym=(await one("select id from goals where name='Gym'")).id;
const study=(await one("select id from goals where name='Study'")).id;
const calories=(await one("select id from goals where progress_source='food_calories'")).id;
const protein=(await one("select id from goals where progress_source='food_protein'")).id;
// Exclude other definitions from this fixture's perfect-day denominator.
await db.query("update goals set status='archived' where id not in ($1,$2,$3,$4)",[gym,study,calories,protein]);
for(let n=0;n<2;n++){await as(n);await one("select set_my_goal_target($1,1700,'2026-09-29')",[calories]);await one("select set_my_goal_target($1,100,'2026-09-29')",[protein]);await one("select set_my_goal_target($1,3600,'2026-09-29')",[study]);}
await as(0);
const food=(await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Fixture','1 serving',1200,100) returning id",[duo,ids[0]])).id;
const extra=(await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Extra','1 serving',500,0) returning id",[duo,ids[0]])).id;
const head=(await one("insert into challenges(duo_id,linked_goal_id,name,mode,metric,target,start_date,end_date,created_by) values($1,$2,'Fixture duel','head_to_head','target_days',1,'2026-09-30','2026-09-30',$3) returning id",[duo,gym,ids[0]])).id;
const team=(await one("insert into challenges(duo_id,linked_goal_id,name,mode,metric,target,start_date,end_date,created_by) values($1,$2,'Fixture team','together','target_days',1,'2026-09-30','2026-09-30',$3) returning id",[duo,gym,ids[0]])).id;
await one("select set_goal_checkin($1,'2026-09-29',1)",[gym]);
await clock('2026-09-30T06:00:00Z');await as(1);
await one("select set_goal_checkin($1,'2026-09-30',1)",[gym]);await one("select set_goal_checkin($1,'2026-09-30',3600)",[study]);
const partnerLog=await one('select * from save_food_log($1,1,null)',[food]);
await clock('2026-10-01T06:00:00Z');await as(0);await one("select set_goal_checkin($1,'2026-10-01',1)",[gym]);
await one("select set_my_goal_target($1,2000,'2026-10-01')",[calories]);await one("select set_my_goal_target($1,7200,'2026-10-01')",[study]);
assert.equal((await one('select * from get_pet_stats($1)',[duo])).current_streak,1);
await one('select finalize_due_goal_days()');await one('select finalize_due_challenges()');
assert.equal((await one('select winner_user_id from challenge_results where challenge_id=$1',[head])).winner_user_id,ids[1]);
assert.equal((await one('select outcome from challenge_results where challenge_id=$1',[team])).outcome,'together_missed');
const oldCalories=await one("select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date='2026-09-30'",[calories,ids[0]]);
assert.equal(oldCalories.completion_tier,'unlogged');
await one("select set_goal_checkin($1,'2026-09-30',1)",[gym]);
assert.equal((await one('select * from get_pet_stats($1)',[duo])).current_streak,3);
assert.equal((await one('select * from get_pet_stats($1)',[duo])).best_streak,3);
await as(1);assert.equal((await one('select * from get_pet_stats($1)',[duo])).current_streak,1);await as(0);
assert.equal((await one('select outcome from challenge_results where challenge_id=$1',[head])).outcome,'tie');
assert.equal((await one('select outcome from challenge_results where challenge_id=$1',[team])).outcome,'together_completed');
await one("select set_goal_checkin($1,'2026-09-30',3600)",[study]);
const studyRow=await one("select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date='2026-09-30'",[study,ids[0]]);
assert.equal(Number(studyRow.target_snapshot),3600);assert.equal(studyRow.completed,true);
async function xp(source,user=ids[0]){return Number((await one("select coalesce(sum(xp_amount),0) xp from pet_xp_events where source_id=$1 and actor_user_id=$2 and local_date='2026-09-30' and source_type='goal_completion' and reversed_at is null",[source,user])).xp);}
assert.equal(await xp(gym),10);
await one("select set_goal_checkin($1,'2026-09-30',0)",[gym]);assert.equal(await xp(gym),0);
assert.equal((await one('select winner_user_id from challenge_results where challenge_id=$1',[head])).winner_user_id,ids[1]);
await one("select set_goal_checkin($1,'2026-09-30',1)",[gym]);await one("select set_goal_checkin($1,'2026-09-30',1)",[gym]);assert.equal(await xp(gym),10);
const logged=await one("select * from save_food_log($1,1,null,'2026-09-30')",[food]);
assert.equal((await one('select local_date::text as day from food_log_entries where id=$1',[logged.id])).day,'2026-09-30');assert.ok(new Date(logged.created_at)>new Date('2026-09-30T18:30:00Z'));
assert.equal(await xp(calories),10);assert.equal(await xp(protein),10);
const finalCalories=await one("select * from goal_checkins where id=$1",[oldCalories.id]);
assert.equal(Number(finalCalories.target_snapshot),1700);assert.deepEqual(finalCalories.finalized_at,oldCalories.finalized_at);assert.equal(finalCalories.completed,true);
async function perfect(){return(await one("select count(*)::int n from pet_xp_events where source_type='perfect_day' and local_date='2026-09-30' and reversed_at is null")).n;}
assert.equal(await perfect(),1);
const added=await one("select * from save_food_log($1,1,null,'2026-09-30')",[extra]);
assert.equal(Number((await one('select value from goal_checkins where id=$1',[oldCalories.id])).value),1700);assert.equal(await xp(calories),10);
await one("select save_food_log($1,1.5,$2,'2026-09-30')",[extra,added.id]);
assert.equal(Number((await one('select value from goal_checkins where id=$1',[oldCalories.id])).value),1950);assert.equal(await xp(calories),0);assert.equal(await perfect(),0);
await one('select delete_food_log($1)',[added.id]);assert.equal(await xp(calories),10);assert.equal(await perfect(),1);
await one('select delete_food_log($1)',[logged.id]);assert.equal(await xp(calories),0);assert.equal(await perfect(),0);
assert.equal((await one('select completion_tier from goal_checkins where id=$1',[oldCalories.id])).completion_tier,'unlogged');
await one("select save_food_log($1,1,null,'2026-09-30')",[food]);assert.equal(await xp(calories),10);assert.equal(await perfect(),1);
// Shared ownership does not grant authority over a partner's personal assignment.
await clock('2026-09-29T06:00:00Z');await as(0);
const personal=(await one("select create_goal('Personal numeric','check','personal','measured','number','cups','',$1::jsonb) id",[JSON.stringify([{user_id:ids[0],target:3}])])).id;
await clock('2026-10-01T06:00:00Z');await as(0);
const numeric=await one("select * from set_goal_checkin($1,'2026-09-30',2.5)",[personal]);assert.equal(Number(numeric.value),2.5);assert.equal(Number(numeric.target_snapshot),3);
await as(1);await reject("select set_goal_checkin($1,'2026-09-30',3)",[personal],'NOT_AUTHORIZED');
await as(0);await db.query("update goals set status='archived' where id=$1",[personal]);
await one("select set_goal_checkin($1,'2026-09-30',3)",[personal]); // eligible historical definition remains correctable after archive
// Snapshot nutrition and timestamps do not become editable client inputs.
await db.query('update foods set calories_per_serving=1300 where id=$1',[food]);
await as(1);const updated=await one("select * from save_food_log($1,1.5,$2,'2026-09-30')",[food,partnerLog.id]);assert.equal(Number(updated.calories_snapshot),1200);
assert.deepEqual(updated.created_at,partnerLog.created_at);assert.ok(new Date(updated.updated_at)>=new Date(updated.created_at));
await reject("select save_food_log($1,1,$2,'2026-09-30')",[food,logged.id],'LOG_UNAVAILABLE');await reject('select delete_food_log($1)',[logged.id],'LOG_UNAVAILABLE');
await reject("update goal_checkins set value=0 where goal_id=$1 and user_id=$2",[gym,ids[0]]);
await reject("update food_log_entries set quantity=2 where id=$1",[partnerLog.id]);
await reject("insert into pet_xp_events(duo_id,source_type,event_key,xp_amount,local_date) values($1,'perfect_day','forged',25,'2026-09-30')",[duo]);
await reject("update challenge_results set winner_user_id=$1 where challenge_id=$2",[ids[1],head]);
await reject("select private.day_is_editable($1,'2026-01-01',now())",[duo]);
await as(2);await reject("select set_goal_checkin($1,'2026-09-30',1)",[gym]);await reject("select save_food_log($1,1,null,'2026-09-30')",[food]);
assert.equal((await one('select count(*)::int n from goal_checkins where goal_id=$1',[gym])).n,0);
await as(0);await reject("select set_goal_checkin($1,'2026-10-02',1)",[gym],'EDITING_WINDOW_CLOSED');await reject("select set_goal_checkin($1,'2026-09-28',1)",[gym]);
// Scheduler uses the same logic and cannot duplicate rewards or erase activity.
const activeBefore=(await owner('select count(*)::int n from user_activity_days')).n;
await one('select private.run_scheduled_finalization()');await one('select private.run_scheduled_finalization()');
assert.equal((await one('select count(*)::int n from user_activity_days')).n,activeBefore);
assert.equal((await one('select count(*)::int n from (select duo_id,event_key from pet_xp_events group by duo_id,event_key having count(*)>1) d')).n,0);
const definitions=(await db.query('select * from goals')).rows;
const assignments=(await db.query('select *,active_from::text,active_until::text from goal_assignments')).rows;
const currentRows=(await db.query("select *,local_date::text from goal_checkins where local_date='2026-10-01'")).rows;
const todayState=goalStateFromRows(definitions,assignments,currentRows,'2026-10-01');
assert.deepEqual(mergeCheckIn(todayState,{...studyRow,local_date:'2026-09-30'},'upsert'),todayState);
const twice=mergeCheckIn(mergeCheckIn(todayState,currentRows[0],'upsert'),currentRows[0],'upsert');
assert.equal(twice.checkIns.filter(row=>row.goalId===currentRows[0].goal_id&&row.userId===currentRows[0].user_id).length,1);
// Exact grace boundary: Sep 30 ends Oct 1 00:00 IST; closes Oct 2 12:00 IST.
await clock('2026-10-02T06:29:00Z');await as(0);
assert.equal((await db.query('select local_date::text from get_editable_days()')).rows.length,3);
await one("select set_goal_checkin($1,'2026-09-30',0)",[gym]);
const frozenResult=await one('select * from challenge_results where challenge_id=$1',[head]);
await clock('2026-10-02T06:30:00Z');await as(0);
assert.equal((await db.query('select local_date::text from get_editable_days()')).rows.length,2);
await reject("select set_goal_checkin($1,'2026-09-30',1)",[gym],'EDITING_WINDOW_CLOSED');
await reject("select save_food_log($1,1,null,'2026-09-30')",[food],'EDITING_WINDOW_CLOSED');
await as(1);await reject('select delete_food_log($1)',[partnerLog.id],'EDITING_WINDOW_CLOSED');await reject('select save_food_log($1,2,$2)',[food,partnerLog.id],'EDITING_WINDOW_CLOSED');
await owner('select private.finalize_challenge($1)',[head]);assert.deepEqual(await one('select * from challenge_results where challenge_id=$1',[head]),frozenResult);
await reject('update goal_checkins set has_food_log=not has_food_log where id=$1',[oldCalories.id],'IMMUTABLE_INPUT_RULE');
await db.close();
console.log('Backfill: exact IST/DST deadlines, server/RLS guards, historical targets/food snapshots, activity bridge, XP/perfect reversal/restoration, calorie 1700/1950, challenge correction/freeze and retry safety passed (PGlite).');
