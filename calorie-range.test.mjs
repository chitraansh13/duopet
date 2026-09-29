import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename,'utf8').replaceAll('"@/lib/','"./'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const { calorieCompletion, calorieRange, calorieRangeMessage } = require('./lib/goal-semantics.ts');
const { isGoalComplete, goalProgress } = require('./lib/goal-data.ts');
const { goalStateFromRows, mergeCheckIn } = require('./lib/repositories/goal-adapters.ts');
const { selectGoals } = require('./lib/goal-state.ts');
const { buildProgress } = require('./lib/progress-history.ts');
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename,'utf8').replaceAll('"@/',`"${process.cwd().replaceAll('\\','/')}/`), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { GoalProgress } = require('./components/goals/GoalProgress.tsx');
const boundaries = [[1299,0,false],[1300,5,true],[1499,5,true],[1500,10,true],[1700,10,true],[1900,10,true],[1901,0,false]];
for (const [value,xp,completed] of boundaries) {
  assert.deepEqual({...calorieCompletion(value,1700,true),outcome:undefined},{outcome:undefined,xp,completed});
  assert.equal(calorieCompletion(value,1700,false).xp,0);
  assert.equal(calorieCompletion(value,1700,false).completed,false);
}
assert.equal(calorieCompletion(1499.99,1700,true).xp,5);
assert.equal(calorieCompletion(1900.01,1700,true).xp,0);
assert.deepEqual(calorieRange(2000),{lower:1800,upper:2200,partialLower:1600});
for(const [value,xp] of [[1599,0],[1600,5],[1799,5],[1800,10],[2200,10],[2201,0]]) assert.equal(calorieCompletion(value,2000,true).xp,xp);
assert.equal(calorieRangeMessage(1420,1700),'80 kcal below target range · Partial-credit range');
assert.equal(calorieRangeMessage(1950,1700),'50 kcal over target range');
assert.equal(calorieRangeMessage(800,1700),'Below your target range');
assert.equal(isGoalComplete({trackingType:'measured',targetDirection:'range'},{target:1700,currentValue:1300,finalized:true}),true);
assert.equal(isGoalComplete({trackingType:'measured',targetDirection:'range'},{target:1700,currentValue:1300}),false);
assert.equal(goalProgress({trackingType:'measured',targetDirection:'range'},{target:1700,currentValue:1300}),0);
const display=renderToStaticMarkup(React.createElement(GoalProgress,{goal:{trackingType:'measured',targetDirection:'range',unit:'kcal'},target:{target:1700,currentValue:1420},label:'You'}));
assert.ok(display.includes('1500')&&display.includes('1900')&&display.includes('80 kcal below target range'));
assert.ok(display.includes('Partial-credit range')&&display.includes('Evaluated at day close'));
assert.ok(!display.includes('progressbar')&&!display.includes('remaining'));

const db = new PGlite({extensions:{btree_gist,pgcrypto}});
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated;
create schema extensions; set search_path=public,extensions;`);
const migrations = readdirSync('supabase/migrations').sort();
const rangeMigration = migrations.find(name=>name.endsWith('_calorie_target_range.sql'));
for (const name of migrations.filter(name=>name<rangeMigration)) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
// A private, disposable test clock exercises real RPCs/rollover, never hosted rows.
await db.exec(`create table private.test_clock(day date); insert into private.test_clock values((now() at time zone 'Pacific/Auckland')::date);
create or replace function private.duo_today(target_duo uuid) returns date language sql stable security definer set search_path='' as $$select day from private.test_clock$$;`);
const users = ['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003'];
for (const id of users) await db.query('insert into auth.users(id) values($1)',[id]);
async function as(n) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[n]]); await db.exec('set role authenticated'); }
async function one(sql,args=[]) { return (await db.query(sql,args)).rows[0]; }
async function owner(sql,args=[]) { await db.exec('reset role'); return one(sql,args); }
async function reject(sql,args=[]) { await assert.rejects(()=>db.query(sql,args)); }
for(let n=0;n<3;n++) { await as(n); await db.query("update profiles set display_name='Test' where id=$1",[users[n]]); }
await as(0); const duo=(await one("select create_duo('Range test','Brownie','Pacific/Auckland') id")).id;
const invite=(await one('select invite_code from duos')).invite_code;
await as(1); await db.query('select join_duo($1)',[invite]);
await as(2); await one("select create_duo('Other','Brownie','UTC')");
await as(0); await one('select seed_default_goals()');
const goal=(await one("select id from goals where progress_source='food_calories'")).id;
await db.query("update goals set status='archived' where progress_source<>'food_calories'");
let day=(await owner('select day::text from private.test_clock')).day;
await as(0); await db.query('select set_my_goal_target($1,1700,$2::date)',[goal,day]);
const food=(await one("insert into foods(duo_id,created_by,name,serving_description,calories_per_serving,protein_grams_per_serving) values($1,$2,'Test meal','1 serving',1000,0) returning id",[duo,users[0]])).id;
await one('select save_food_log($1,1,null)',[food]);
// Legacy maximum day is successful at 1000 kcal. Preserve it rather than recasting as a failed range day.
await owner('update private.test_clock set day=day+1');
await as(0); await one('select finalize_due_goal_days()');
const legacy=(await one('select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[goal,users[0],day]));
await db.exec('reset role');
const allLedgerBefore=(await db.query('select id,event_key,xp_amount,reversed_at from pet_xp_events order by id')).rows;
assert.equal(legacy.completed,true); assert.equal(legacy.direction_snapshot,'maximum');
// An open legacy day already has its semantics saved, so conversion must not
// silently downgrade its eventual award to 5 XP.
const openLegacyDay=(await one('select day::text from private.test_clock')).day;
await as(0); await db.query('update foods set calories_per_serving=1420 where id=$1',[food]);
await one('select save_food_log($1,1,null)',[food]);
const openLegacy=await one('select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[goal,users[0],openLegacyDay]);
await db.exec('reset role');
await db.exec(readFileSync('supabase/migrations/'+rangeMigration,'utf8'));
assert.deepEqual((await db.query('select id,event_key,xp_amount,reversed_at from pet_xp_events order by id')).rows,allLedgerBefore);
const legacyAfter=await one('select * from goal_checkins where id=$1',[legacy.id]);
for (const key of Object.keys(legacy)) assert.deepEqual(legacyAfter[key],legacy[key],key);
assert.equal(legacyAfter.lower_tolerance_snapshot,null);
assert.equal((await one('select target_direction from goals where id=$1',[goal])).target_direction,'range');
assert.equal((await one('select direction_snapshot from goal_checkins where id=$1',[openLegacy.id])).direction_snapshot,'maximum');
await owner('update private.test_clock set day=day+1');
await one('select private.run_scheduled_finalization()');
assert.equal(Number((await one("select xp_amount from pet_xp_events where source_type='goal_completion' and actor_user_id=$1 and local_date=$2::date",[users[0],openLegacyDay])).xp_amount),10);

for (const [value,xp,completed] of boundaries) {
  day=(await owner('select day::text from private.test_clock')).day;
  await as(0); await db.query('update foods set calories_per_serving=$1 where id=$2',[value,food]);
  const entry=await one('select * from save_food_log($1,1,null)',[food]);
  // Repeated edits and undo/re-add cannot mint midday XP.
  await one('select save_food_log($1,1,$2)',[food,entry.id]);
  await one('select delete_food_log($1)',[entry.id]); await one('select save_food_log($1,1,null)',[food]);
  await as(1); await one('select set_my_goal_target($1,2000,$2::date)',[goal,day]);
  // Catalog is shared but per-day target and totals belong to each member.
  await as(0); await db.query('update foods set calories_per_serving=2000 where id=$1',[food]);
  await as(1); await one('select save_food_log($1,1,null)',[food]);
  const open=(await one('select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[goal,users[0],day]));
  assert.equal(open.completed,false); assert.equal(open.completion_tier,'pending');
  assert.equal(Number(open.value),value); assert.equal(Number(open.target_snapshot),1700);
  assert.equal(Number(open.lower_tolerance_snapshot),200);
  assert.equal((await one("select count(*)::int n from pet_xp_events where local_date=$1::date and reversed_at is null",[day])).n,0);
  await reject('select set_goal_checkin($1,$2::date,1700)',[goal,day]);
  await reject('update goal_checkins set finalized_at=now() where id=$1',[open.id]);
  await reject("update goal_checkins set lower_tolerance_snapshot=9999 where id=$1",[open.id]);
  await reject("update goals set lower_tolerance=9999 where id=$1",[goal]);
  await reject("update goals set target_direction='maximum' where id=$1",[goal]);
  await reject('select private.run_scheduled_finalization()');
  await as(2); assert.equal((await one('select count(*)::int n from goal_checkins where goal_id=$1',[goal])).n,0);
  await reject('select set_my_goal_target($1,1900,$2::date)',[goal,day]);
  await owner('update private.test_clock set day=day+1');
  assert.equal((await one('select private.run_scheduled_finalization() n')).n,2);
  assert.equal((await one('select private.run_scheduled_finalization() n')).n,0);
  const closed=await one('select * from goal_checkins where id=$1',[open.id]);
  assert.equal(closed.completed,completed,`completion at ${value}`);
  assert.equal(closed.completion_tier,xp===10?'full':xp===5?'partial':'failed');
  assert.equal(Number((await one("select coalesce(sum(xp_amount),0) xp from pet_xp_events where source_type='goal_completion' and actor_user_id=$1 and local_date=$2::date and reversed_at is null",[users[0],day])).xp),xp,`XP at ${value}`);
  assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='perfect_day' and local_date=$1::date and reversed_at is null",[day])).n,Number(completed));
  assert.equal((await one("select count(*)::int n from pet_xp_events where source_type='duo_goal_completion' and local_date=$1::date and reversed_at is null",[day])).n,Number(completed));
  // Even owner-side accidental mutation cannot rewrite a finalized calorie snapshot.
  await reject('update goal_checkins set value=value+1 where id=$1',[closed.id]);
  await reject('update goal_checkins set upper_tolerance_snapshot=999 where id=$1',[closed.id]);
}
// Today's target edit changes the range; old target/tolerances/XP never change.
day=(await owner('select day::text from private.test_clock')).day;
await as(0); await one('select set_my_goal_target($1,2000,$2::date)',[goal,day]);
await db.query('update foods set calories_per_serving=1799 where id=$1',[food]); await one('select save_food_log($1,1,null)',[food]);
let current=await one('select * from goal_checkins where goal_id=$1 and user_id=$2 and local_date=$3::date',[goal,users[0],day]);
assert.equal(Number(current.target_snapshot),2000);
await one('select set_my_goal_target($1,2100,$2::date)',[goal,day]);
current=await one('select * from goal_checkins where id=$1',[current.id]); assert.equal(Number(current.target_snapshot),2100);
await one('select set_my_goal_target($1,2200,$2::date+1)',[goal,day]);
assert.equal(Number((await one('select target_snapshot from goal_checkins where id=$1',[current.id])).target_snapshot),2100);
const goals=(await owner('select * from goals where id=$1',[goal]));
const assignments=(await db.query('select *,active_from::text,active_until::text from goal_assignments where goal_id=$1',[goal])).rows;
const checks=(await db.query('select *,local_date::text from goal_checkins where goal_id=$1',[goal])).rows;
const historical=checks.find(row=>Number(row.value)===1300);
assert.equal(Number(historical.target_snapshot),1700); assert.equal(historical.completion_tier,'partial');
const projected=selectGoals(goalStateFromRows([goals],assignments,checks,day))[0];
assert.equal(projected.targets.find(t=>t.userId===users[0]).target,2100);
assert.equal(projected.targets.find(t=>t.userId===users[1]).target,2000);
const merged=selectGoals(mergeCheckIn(goalStateFromRows([goals],assignments,checks,historical.local_date),historical,'upsert'))[0];
assert.equal(isGoalComplete(merged,merged.targets.find(t=>t.userId===users[0])),true);
const status=(await db.query('select *,effective_date::text from goal_status_events')).rows;
const progress=buildProgress([goals],assignments,checks,[],status,{current_streak:0,best_streak:0},{timezone:'Pacific/Auckland',members:users.slice(0,2).map(userId=>({userId}))},users[0],day);
assert.ok(progress.habits[0].rates.month.partialRangeDays>=2);
assert.ok(progress.habits[0].rates.month.failedRangeDays>=2);
assert.ok(progress.habits[0].rates.month.fullRangeDays>=4);
// Changing future tolerance policy does not reinterpret an existing day.
await owner('update goals set lower_tolerance=100,upper_tolerance=100,partial_under_tolerance=100 where id=$1',[goal]);
assert.equal(Number((await one('select lower_tolerance_snapshot from goal_checkins where id=$1',[current.id])).lower_tolerance_snapshot),200);
assert.equal((await one('select completion_tier from goal_checkins where id=$1',[historical.id])).completion_tier,'partial');
assert.equal((await one('select count(*)::int n from (select event_key from pet_xp_events group by duo_id,event_key having count(*)>1) d')).n,0);
await db.close();
console.log('Calorie range boundaries, trusted food totals, no midday XP, partial/full idempotency, perfect days, independent targets, legacy preservation and snapshots passed (PGlite).');
