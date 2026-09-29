import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,'utf8').replaceAll('"@/lib/','"./'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {calorieAllowance,calorieCompletion,calorieAllowanceMessage}=require('./lib/goal-semantics.ts');
const {duoDateKey}=require('./lib/date.ts');
const {buildProgress}=require('./lib/progress-history.ts');
const {isGoalComplete}=require('./lib/goal-data.ts');
const {goalStateFromRows}=require('./lib/repositories/goal-adapters.ts');
const {selectGoals}=require('./lib/goal-state.ts');
const semantics={lowerTolerance:200,upperTolerance:200,partialUnderTolerance:200,loggedRequired:true};
for(const value of [0,900,1300,1500,1700,1900]) {
  assert.deepEqual(calorieAllowance(value,1700,true,true),{outcome:'full',completed:true,xp:10});
  assert.equal(calorieCompletion(value,1700,true,semantics,true).xp,10);
  assert.deepEqual(calorieAllowance(value,1700,false,true),{outcome:'unlogged',completed:false,xp:0});
  assert.equal(calorieAllowance(value,1700,true,false).xp,0);
}
assert.deepEqual(calorieAllowance(1901,1700,true,true),{outcome:'over',completed:false,xp:0});
assert.equal(calorieAllowance(2200,2000,true,true).completed,true);
assert.equal(calorieAllowance(2201,2000,true,true).completed,false);
assert.equal(calorieAllowanceMessage(900,1700,true),'Currently within allowance');
assert.equal(calorieAllowanceMessage(1950,1700,true),'50 kcal over allowance');
assert.equal(calorieAllowanceMessage(0,1700,false),'No food logged');
assert.equal(isGoalComplete({trackingType:'measured',targetDirection:'range',rangeSemantics:semantics},{target:1700,currentValue:0,finalized:true}),false);
assert.equal(duoDateKey('Asia/Kolkata',new Date('2026-09-29T18:29:59Z')),'2026-09-29');
assert.equal(duoDateKey('Asia/Kolkata',new Date('2026-09-29T18:30:00Z')),'2026-09-30');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,'utf8').replaceAll('"@/',`"${process.cwd().replaceAll('\\','/')}/`),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {GoalProgress}=require('./components/goals/GoalProgress.tsx');
for(const [hasFoodLog,value,message] of [[false,0,'No food logged'],[true,900,'Currently within allowance'],[true,1950,'50 kcal over allowance']]){
  const display=renderToStaticMarkup(React.createElement(GoalProgress,{goal:{trackingType:'measured',targetDirection:'range',rangeSemantics:semantics,unit:'kcal'},target:{target:1700,currentValue:value,hasFoodLog},label:'You'}));
  assert.ok(display.includes(message)&&display.includes('Allowed up to')&&display.includes('Evaluated at day close'));
  assert.ok(!display.includes('Partial-credit')&&!display.includes('Below your target range')&&!display.includes('progressbar'));
}

const db=new PGlite({extensions:{btree_gist,pgcrypto}});
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated; create schema extensions; set search_path=public,extensions;`);
const files=readdirSync('supabase/migrations').sort(),migration=files.find(f=>f.endsWith('_activity_streak_and_logged_calories.sql'));
for(const file of files.filter(f=>f<migration)) await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
const ids=[1,2,3].map(n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
async function as(n){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[n]]);await db.exec('set role authenticated');}
async function one(sql,args=[]){return(await db.query(sql,args)).rows[0];}
async function owner(sql,args=[]){await db.exec('reset role');return one(sql,args);}
async function reject(sql,args=[]){await assert.rejects(()=>db.query(sql,args));}
for(let n=0;n<3;n++){await as(n);await db.query("update profiles set display_name='Test' where id=$1",[ids[n]]);}
await as(0);const duo=(await one("select create_duo('Test','Brownie','Asia/Kolkata') id")).id;
const code=(await one('select invite_code from duos')).invite_code;
await as(1);await one('select join_duo($1)',[code]);await as(2);await one("select create_duo('Other','Brownie','UTC')");
await db.exec('reset role');
await db.exec(`create table private.test_clock(day date); insert into private.test_clock values((now() at time zone 'Asia/Kolkata')::date)`);
await db.exec("create or replace function private.duo_today(target_duo uuid) returns date language sql stable security definer set search_path='' as $$select day from private.test_clock$$");
await as(0);await one('select seed_default_goals()');
const calorie=(await one("select id from goals where progress_source='food_calories'")).id;
const gym=(await one("select id from goals where name='Gym'")).id;
const study=(await one("select id from goals where name='Study'")).id;
let day=(await owner('select day::text from private.test_clock')).day;
await as(0);await one('select set_my_goal_target($1,1700,$2::date)',[calorie,day]);
const food=(await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Meal','1 serving',1300,0) returning id",[duo,ids[0]])).id;
await one('select save_food_log($1,1,null)',[food]);
await owner('update private.test_clock set day=day+1');await one('select private.run_scheduled_finalization()');
const partial=(await one("select * from pet_xp_events where source_id=$1 and actor_user_id=$2 and source_type='goal_completion'",[calorie,ids[0]]));
assert.equal(partial.xp_amount,5);
const finalizedBefore=(await db.query('select *,local_date::text from goal_checkins where finalized_at is not null order by id')).rows;
const xpBefore=(await db.query('select * from pet_xp_events order by id')).rows;
// An already-open legacy maximum projection adopts the input rule as well.
await owner('update goals set range_effective_from=(select day+1 from private.test_clock) where id=$1',[calorie]);
await as(0);await one('select save_food_log($1,1,null)',[food]);await db.exec('reset role');
await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
assert.deepEqual((await db.query('select * from pet_xp_events order by id')).rows,xpBefore);
const finalizedAfter=(await db.query('select *,local_date::text from goal_checkins where finalized_at is not null order by id')).rows;
for(let n=0;n<finalizedBefore.length;n++)for(const key of Object.keys(finalizedBefore[n]))assert.deepEqual(finalizedAfter[n][key],finalizedBefore[n][key]);
day=(await one('select day::text from private.test_clock')).day;
assert.equal((await one('select logged_required_snapshot from goal_checkins where goal_id=$1 and local_date=$2::date',[calorie,day])).logged_required_snapshot,true);
assert.equal((await one('select direction_snapshot from goal_checkins where goal_id=$1 and local_date=$2::date',[calorie,day])).direction_snapshot,'maximum');
assert.equal(Number((await one('select upper_tolerance_snapshot from goal_checkins where goal_id=$1 and local_date=$2::date',[calorie,day])).upper_tolerance_snapshot),200);

async function stats(n){await as(n);return one('select * from get_pet_stats($1)',[duo]);}
assert.equal((await stats(0)).current_streak,2); // retained food yesterday + open food today
assert.equal((await stats(1)).current_streak,0); // automatic zero projections do not count
await one('select finalize_due_goal_days()');assert.equal((await stats(1)).current_streak,0);
await reject('insert into user_activity_days(duo_id,user_id,local_date) values($1,$2,$3::date)',[duo,ids[0],day]);
assert.equal((await one('select count(*)::int n from user_activity_days where user_id=$1',[ids[0]])).n,0); // self-only RLS
await one('select set_goal_checkin($1,$2::date,1)',[gym,day]);assert.equal((await stats(1)).current_streak,1);
await one('select set_goal_checkin($1,$2::date,0)',[gym,day]);assert.equal((await stats(1)).current_streak,1); // input already occurred
await owner('update private.test_clock set day=day+1');day=(await one('select day::text from private.test_clock')).day;
assert.equal((await stats(1)).current_streak,1); // through yesterday, today not yet active
await one('select set_goal_checkin($1,$2::date,1800)',[study,day]);assert.equal((await stats(1)).current_streak,2);
assert.equal((await stats(1)).best_streak,2);assert.equal((await stats(0)).current_streak,2); // B does not add A's day
await owner('update private.test_clock set day=day+2');day=(await one('select day::text from private.test_clock')).day;
assert.equal((await stats(1)).current_streak,0);assert.equal((await stats(1)).best_streak,2);
await one('select set_goal_checkin($1,$2::date,1)',[gym,day]);assert.equal((await stats(1)).current_streak,1);assert.equal((await stats(1)).best_streak,2);
await as(2);assert.equal((await one('select count(*)::int n from user_activity_days where duo_id=$1',[duo])).n,0);await reject('select get_pet_stats($1)',[duo]);

// Keep only Calories to isolate calorie-dependent Perfect Duo Day boundaries.
await as(0);await db.query("update goals set status='archived' where progress_source<>'food_calories'");
await owner('update private.test_clock set day=day+1');
for(const value of [null,0,900,1300,1500,1700,1900,1901]){
  day=(await owner('select day::text from private.test_clock')).day;
  await as(0);await one('select set_my_goal_target($1,1700,$2::date)',[calorie,day]);
  if(value!==null){await db.query('update foods set calories_per_serving=$1 where id=$2',[value,food]);const entry=await one('select * from save_food_log($1,1,null)',[food]);await one('select save_food_log($1,1.5,$2)',[food,entry.id]);await one('select save_food_log($1,1,$2)',[food,entry.id]);assert.ok((await stats(0)).current_streak>=1);}
  await as(0);await db.query('update foods set calories_per_serving=2200 where id=$1',[food]);await as(1);await one('select set_my_goal_target($1,2000,$2::date)',[calorie,day]);await one('select save_food_log($1,1,null)',[food]);
  await as(0);await reject('select set_goal_checkin($1,$2::date,900)',[calorie,day]);await reject('update goal_checkins set has_food_log=true where goal_id=$1',[calorie]);await reject('update goals set logged_required=false where id=$1',[calorie]);
  assert.equal((await one("select count(*)::int n from pet_xp_events where local_date=$1::date and source_type in ('goal_completion','perfect_day') and reversed_at is null",[day])).n,0);
  const activeBeforeClose=(await owner('select count(*)::int n from user_activity_days')).n;
  await owner('update private.test_clock set day=day+1');await one('select private.run_scheduled_finalization()');assert.equal((await one('select private.run_scheduled_finalization() n')).n,0);
  assert.equal((await one('select count(*)::int n from user_activity_days')).n,activeBeforeClose);
  const row=await one('select *,local_date::text from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[calorie,ids[0],day]);
  const completed=value!==null&&value<=1900;
  assert.equal(row.completed,completed,`completion at ${value}`);assert.equal(row.has_food_log,value!==null);
  assert.equal(row.completion_tier,value===null?'unlogged':completed?'full':'failed');assert.equal(Number(row.target_snapshot),1700);
  assert.equal(Number((await one("select coalesce(sum(xp_amount),0) xp from pet_xp_events where source_id=$1 and actor_user_id=$2 and local_date=$3::date and reversed_at is null",[calorie,ids[0],day])).xp),completed?10:0);
  assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='perfect_day' and local_date=$1::date and reversed_at is null",[day])).n,Number(completed));
  if(value===null)assert.equal((await one('select count(*)::int n from user_activity_days where user_id=$1 and local_date=$2::date',[ids[0],day])).n,0);
  await reject('update goal_checkins set has_food_log=not has_food_log where id=$1',[row.id]);
  const definitions=(await db.query('select * from goals where id=$1',[calorie])).rows,assignments=(await db.query('select *,active_from::text,active_until::text from goal_assignments where goal_id=$1',[calorie])).rows;
  const projection=selectGoals(goalStateFromRows(definitions,assignments,[row],day))[0];
  assert.equal(isGoalComplete(projection,projection.targets.find(t=>t.userId===ids[0])),completed);
}
// Real zero-nutrition food is input; deleting it does not erase activity, but
// does restore the current calorie day to unlogged/incomplete.
day=(await one('select day::text from private.test_clock')).day;await as(0);await db.query('update foods set calories_per_serving=0 where id=$1',[food]);
const zero=await one('select * from save_food_log($1,1,null)',[food]);await one('select delete_food_log($1)',[zero.id]);
assert.equal((await one('select has_food_log from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[calorie,ids[0],day])).has_food_log,false);assert.ok((await stats(0)).current_streak>=1);
assert.equal((await one('select xp_amount from pet_xp_events where id=$1',[partial.id])).xp_amount,5);
await db.exec('reset role');
const goals=(await db.query('select * from goals where id=$1',[calorie])).rows,assignments=(await db.query('select *,active_from::text,active_until::text from goal_assignments')).rows,checks=(await db.query('select *,local_date::text from goal_checkins')).rows,statuses=(await db.query('select *,effective_date::text from goal_status_events')).rows,active=(await db.query('select local_date::text from user_activity_days where user_id=$1',[ids[0]])).rows.map(r=>r.local_date);
const progress=buildProgress(goals,assignments,checks,[],statuses,{current_streak:3,best_streak:5},{timezone:'Asia/Kolkata',members:ids.slice(0,2).map(userId=>({userId}))},ids[0],day,true,active);
assert.equal(progress.streak.recentDays.find(r=>r.date===day).successful,true);assert.ok(progress.habits[0].rates.month.unloggedDays>0);
assert.equal((await one('select count(*)::int n from (select duo_id,event_key from pet_xp_events group by duo_id,event_key having count(*)>1) d')).n,0);
await db.close();
console.log('Activity streak ownership/gaps/best, required food input, calorie allowance boundaries, no midday XP, perfect days, legacy XP, snapshots and retry safety passed (PGlite).');
