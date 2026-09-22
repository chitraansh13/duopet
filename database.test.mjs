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
const missingId = '00000000-0000-4000-8000-000000000099';
const preservedId = '00000000-0000-4000-8000-000000000098';
let bootstrapChecks = 0;
for (const file of readdirSync('supabase/migrations').sort()) {
  if (file === '202609200001_repair_profile_bootstrap.sql') {
    // Match hosted drift: Auth users survive a test-data reset of profiles.
    await db.query('insert into auth.users(id) values ($1)',[missingId]);
    await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)',[preservedId,JSON.stringify({ optional: 'ignored' })]);
    assert.equal((await db.query('select count(*)::int n from profiles where id=$1',[missingId])).rows[0].n,1); bootstrapChecks++;
    await db.query("update profiles set display_name='Keep this name' where id=$1",[preservedId]);
    await db.query('delete from profiles where id=$1',[missingId]);
  }
  try { await db.exec(readFileSync('supabase/migrations/'+file,'utf8')); }
  catch(error) { console.error(file, error.message); process.exitCode=1; await db.close(); process.exit(1); }
}
assert.equal((await db.query('select count(*)::int n from profiles where id=$1',[missingId])).rows[0].n,1); bootstrapChecks++;
assert.equal((await db.query('select display_name from profiles where id=$1',[preservedId])).rows[0].display_name,'Keep this name'); bootstrapChecks++;
const repair = readFileSync('supabase/migrations/202609200001_repair_profile_bootstrap.sql','utf8');
await db.exec(repair);
assert.equal((await db.query('select count(*)::int n from profiles where id in ($1,$2)',[missingId,preservedId])).rows[0].n,2); bootstrapChecks++;
assert.equal((await db.query('select display_name from profiles where id=$1',[preservedId])).rows[0].display_name,'Keep this name'); bootstrapChecks++;
for (const [id,metadata] of [
  ['00000000-0000-4000-8000-000000000097',null],
  ['00000000-0000-4000-8000-000000000096',JSON.stringify({})],
]) {
  await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)',[id,metadata]);
  assert.equal((await db.query('select count(*)::int n from profiles where id=$1',[id])).rows[0].n,1); bootstrapChecks++;
}
assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname='on_auth_user_created' and tgrelid='auth.users'::regclass")).rows[0].n,1); bootstrapChecks++;
const ids = [1,2,3,4].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
for(const id of ids) await db.query('insert into auth.users values ($1)',[id]);
async function as(n) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[n]]); await db.exec('set role authenticated'); }
async function one(sql,args=[]) { return (await db.query(sql,args)).rows[0]; }
let checks=0;
async function reject(sql,args=[]) { await assert.rejects(()=>db.query(sql,args)); checks++; }
await as(0);
assert.equal((await db.query("update profiles set nickname='Own' where id=$1 returning id",[ids[0]])).rows.length,1); checks++;
assert.equal((await db.query("update profiles set nickname='Wrong' where id=$1 returning id",[ids[1]])).rows.length,0); checks++;
for(let n=0;n<4;n++) { await as(n); await db.query("update profiles set display_name=$1 where id=$2",['User '+n,ids[n]]); }
await as(0);
await reject("select create_duo(null,'Brownie','Mars/City')");
const duo=(await one("select create_duo('Our duo','Brownie','UTC') as id")).id;
const code=(await one('select invite_code from duos')).invite_code;
await db.exec('reset role');
const duoToday=(await one('select private.duo_today($1)::text as day',[duo])).day;
await as(0);
assert.match(code,/^[A-F0-9]{32}$/); checks++;
assert.deepEqual((await db.query('select item_id from pet_unlocks where duo_id=$1 order by item_id',[duo])).rows.map(row=>row.item_id),['basic-collar','cozy-bed','none']); checks++;
assert.deepEqual((await db.query('select item_id from pet_room_items where duo_id=$1',[duo])).rows.map(row=>row.item_id),['cozy-bed']); checks++;
await reject("select create_duo(null,'Brownie','UTC')");
await reject('insert into duo_members(duo_id,user_id,slot) values($1,$2,2)',[duo,ids[1]]);
await as(1); await reject("select join_duo('BAD')"); await reject("select join_duo('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')"); await db.query('select join_duo($1)',[code]);
assert.equal((await one('select count(*)::int as n from profiles')).n,1); checks++;
const context=(await one('select get_duo_context() as data')).data;
assert.equal(context.members.length,2); assert.equal('brownie_encouragement' in context.members[0],false); checks++;
await reject('select join_duo($1)',[code]);
await as(2); await reject('select join_duo($1)',[code]);
const other=(await one("select create_duo(null,'Cocoa','America/New_York') as id")).id;
assert.equal((await one('select count(*)::int as n from duos where id=$1',[duo])).n,0); checks++;
await as(0);
assert.equal((await one('select seed_default_goals() as seeded')).seeded,true); checks++;
assert.equal((await one('select seed_default_goals() as seeded')).seeded,false); checks++;
assert.equal((await one('select count(*)::int n from goals')).n,5); checks++;
const studyTargets=await db.query("select a.user_id,a.target_value from goal_assignments a join goals g on g.id=a.goal_id where g.name='Study' order by a.user_id");
assert.deepEqual(studyTargets.rows.map(row=>Number(row.target_value)),[14400,10800]); checks++;
const sharedTargets=JSON.stringify([{user_id:ids[0],target:10},{user_id:ids[1],target:99}]);
const goal=(await one("select create_goal('Read','study','shared','measured','number','pages',null,$1::jsonb) as id",[sharedTargets])).id;
assert.deepEqual((await db.query('select target_value::int target from goal_assignments where goal_id=$1 order by user_id',[goal])).rows.map(row=>row.target),[10,10]); checks++;
assert.equal((await one("select has_function_privilege(current_user,'private.insert_goal_definition(uuid,uuid,text,text,text,text,text,text,text,jsonb)','execute') as allowed")).allowed,false); checks++;
assert.equal((await one("select has_table_privilege(current_user,'goal_assignments','insert,update,delete') as allowed")).allowed,false); checks++;
await reject("insert into goals(duo_id,scope,name,tracking_type,created_by) values($1,'shared','Wrong','boolean',$2)",[other,ids[0]]);
await reject("insert into goal_assignments(goal_id,user_id,target_value,canonical_unit,active_from) values($1,$2,20,'pages',$3::date)",[goal,ids[0],duoToday]);
const personalTargets=JSON.stringify([{user_id:ids[0],target:null}]);
const personal=(await one("select create_goal('DSA','brain','personal','boolean',null,null,null,$1::jsonb) as id",[personalTargets])).id;
await db.query("update goals set status='archived' where id<>$1",[goal]);
assert.equal((await one("select status from goals where name='Gym'")).status,'archived'); checks++;
await as(1);
assert.equal((await db.query("update goals set name='Not mine' where id=$1 returning id",[personal])).rows.length,0); checks++;
await reject('insert into goal_checkins(goal_id,user_id,local_date,value) values($1,$2,$3::date,1)',[personal,ids[1],duoToday]);
await as(0);
await db.query('select set_goal_checkin($1,$2::date,10)',[goal,duoToday]);
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,10); checks++;
await db.query('select set_goal_checkin($1,$2::date,10)',[goal,duoToday]);
assert.equal((await one('select count(*)::int n from pet_xp_events')).n,1); checks++;
await db.query('select set_goal_checkin($1,$2::date,0)',[goal,duoToday]);
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,0); checks++;
await db.query('select set_goal_checkin($1,$2::date,10)',[goal,duoToday]);
assert.equal((await one('select count(*)::int n from pet_xp_events')).n,1); checks++;
await reject('insert into goal_checkins(goal_id,user_id,local_date,value) values($1,$2,$3::date,10)',[goal,ids[1],duoToday]);
const changedTargets=JSON.stringify([{user_id:ids[0],target:20},{user_id:ids[1],target:10}]);
await db.query("select update_goal($1,'Read','study',null,$2::jsonb)",[goal,changedTargets]);
let check=await one('select completed,target_snapshot from goal_checkins'); assert.equal(check.completed,true); assert.equal(Number(check.target_snapshot),10); checks++;
assert.equal(Number((await one('select target_value from goal_assignments where goal_id=$1 and user_id=$2 and active_until is null',[goal,ids[0]])).target_value),10); checks++;
await db.query('select set_my_goal_target($1,20,$2::date)',[goal,duoToday]);
check=await one('select completed,target_snapshot from goal_checkins where user_id=$1',[ids[0]]); assert.equal(check.completed,false); assert.equal(Number(check.target_snapshot),20); checks++;
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,0); checks++;
await db.query('select set_my_goal_target($1,30,$2::date+1)',[goal,duoToday]);
assert.deepEqual((await db.query('select active_from-$3::date as offset_days,target_value::int target from goal_assignments where goal_id=$1 and user_id=$2 order by active_from',[goal,ids[0],duoToday])).rows,[{offset_days:0,target:20},{offset_days:1,target:30}]); checks++;
await db.query('select set_goal_checkin($1,$2::date,20)',[goal,duoToday]);
await as(1); assert.equal((await db.query('update goal_checkins set value=0 where user_id=$1 returning id',[ids[0]])).rows.length,0); checks++;
await reject('update goal_assignments set target_value=99 where goal_id=$1 and user_id=$2',[goal,ids[0]]);
await db.query('select set_goal_checkin($1,$2::date,10)',[goal,duoToday]);
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,55); checks++;
assert.equal((await one('select count(*)::int n from pet_xp_events')).n,4); checks++;
await db.query('select set_goal_checkin($1,$2::date,0)',[goal,duoToday]);
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,10); checks++;
await db.query('select set_goal_checkin($1,$2::date,10)',[goal,duoToday]);
assert.equal((await one('select coalesce(sum(xp_amount) filter(where reversed_at is null),0)::int n from pet_xp_events')).n,55); checks++;
assert.equal((await one('select count(*)::int n from pet_xp_events')).n,4); checks++;
const challenge=(await one("insert into challenges(duo_id,linked_goal_id,name,mode,metric,target,start_date,end_date,created_by) values($1,$2,'Read together','together','target_days',5,$4::date,$4::date+6,$3) returning id",[duo,goal,ids[1],duoToday])).id;
await reject("insert into pet_xp_events(duo_id,source_type,source_id,event_key,xp_amount,local_date) values($1,'perfect_day',$1,'test',10,$2::date)",[duo,duoToday]);
await reject('delete from goals where id=$1',[goal]);
await db.query("update goals set status='archived' where id=$1",[goal]);
assert.equal((await one('select count(*)::int n from goal_checkins')).n,2); checks++;
await reject('update goal_checkins set value=0 where user_id=$1',[ids[1]]);
await as(2);
for(const table of ['goals','goal_assignments','goal_checkins','challenges','pet_xp_events']) { assert.equal((await one(`select count(*)::int n from ${table}`)).n,0); checks++; }
await reject('select set_goal_checkin($1,$2::date,1)',[goal,duoToday]);
await db.exec('reset role');
await db.query("insert into pet_xp_events(duo_id,source_type,source_id,event_key,xp_amount,local_date) values($1,'perfect_day',$1,'manual-ledger-test',10,$2::date)",[duo,duoToday]);
await reject("insert into pet_xp_events select * from pet_xp_events");
await db.exec('update pet_xp_events set reversed_at=now(); update pet_xp_events set reversed_at=null;');
assert.equal((await one('select sum(xp_amount)::int n from pet_xp_events where reversed_at is null')).n,65); checks++;
await reject("update challenges set status='completed' where id=$1",[challenge]);
await db.exec("begin");
await db.query("update challenges set status='completed' where id=$1",[challenge]);
await db.query("insert into challenge_results(challenge_id,outcome,shared_score,calculation_version) values($1,'together_missed',0,'v1')",[challenge]);
for(const id of ids.slice(0,2)) await db.query('insert into challenge_result_members values($1,$2,0)',[challenge,id]);
await db.exec('commit');
await reject('update challenge_results set shared_score=1');
await reject('insert into challenge_result_members values($1,$2,0)',[challenge,ids[2]]);
await reject('insert into duo_members(duo_id,user_id,slot) values($1,$2,3)',[duo,ids[3]]);
await as(0);
await reject('update duos set timezone=$1 where id=$2',['Asia/Tokyo',duo]);
await reject("update duo_pets set equipped_accessory_id='locked-hat' where duo_id=$1",[duo]);
await reject("insert into pet_room_items values($1,'locked-room-item')",[duo]);
assert.equal((await db.query("update profiles set nickname='Intrusion' where id=$1 returning id",[ids[1]])).rows.length,0); checks++;
await as(2);
for(const table of ['duos','duo_members','duo_pets','pet_unlocks','pet_room_items','pet_xp_events']) { assert.equal((await one(`select count(*)::int n from ${table} where ${table==='duos'?'id':'duo_id'}=$1`,[duo])).n,0); checks++; }
for(const table of ['challenge_results','challenge_result_members']) { assert.equal((await one(`select count(*)::int n from ${table}`)).n,0); checks++; }
await db.exec('reset role; set role anon');
await reject('select * from profiles'); await reject('select get_duo_context()'); await reject("select create_duo(null,'Brownie','UTC')"); await reject('select set_goal_checkin($1,$2::date,1)',[goal,duoToday]);
await db.exec('reset role');
await db.exec(readFileSync('supabase/manual/DESTRUCTIVE_TEST_DATA_RESET.sql','utf8'));
for(const table of ['duos','duo_members','duo_pets','pet_unlocks','pet_room_items','goals','goal_assignments','goal_checkins','challenges','challenge_results','challenge_result_members','pet_xp_events']) {
  assert.equal((await one(`select count(*)::int n from ${table}`)).n,0); checks++;
}
assert.equal((await one('select count(*)::int n from auth.users')).n,8); checks++;
assert.equal((await one('select count(*)::int n from profiles')).n,8); checks++;
console.log(`Database migrations and ${checks + bootstrapChecks} security/invariant assertions passed (PGlite PostgreSQL).`);
await db.close();

