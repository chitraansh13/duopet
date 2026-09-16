const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8').replaceAll('"@/lib/','"./'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {duoDateKey}=require('./lib/date.ts');
const {validInvite,normalizeInvite,formatInvite,onboardingStep,validTimezone}=require('./lib/auth/domain.ts');
const {profileFromRow,duoFromJson}=require('./lib/repositories/adapters.ts');
assert.equal(duoDateKey('America/Los_Angeles',new Date('2026-01-01T01:00:00Z')),'2025-12-31');
assert.equal(duoDateKey('Asia/Tokyo',new Date('2026-01-01T23:00:00Z')),'2026-01-02');
assert.equal(duoDateKey('America/New_York',new Date('2026-03-08T07:00:00Z')),'2026-03-08');
assert.equal(duoDateKey('America/New_York',new Date('2026-11-01T06:00:00Z')),'2026-11-01');
assert.equal(validTimezone('Mars/City'),false); assert.equal(validTimezone('UTC'),true);
const code='0123456789abcdef0123456789abcdef';assert.equal(validInvite(formatInvite(code)),true);assert.equal(normalizeInvite(formatInvite(code)),code.toUpperCase());assert.equal(validInvite('BAD'),false);
const profile=profileFromRow({id:'real-user-id',display_name:'A',nickname:null,initials:null,avatar_url:null,brownie_encouragement:false,created_at:'2026-01-01',updated_at:'2026-01-01'});
assert.equal(profile.nickname,'');assert.equal(profile.brownieEncouragement,false);
assert.equal(onboardingStep(null,null),'profile');assert.equal(onboardingStep({...profile,displayName:' '},null),'profile');assert.equal(onboardingStep(profile,null),'duo');
assert.equal(duoFromJson(null),null);assert.throws(()=>duoFromJson({members:[]}));
const duo=duoFromJson({duo:{id:'duo-id',display_name:null,timezone:'UTC',invite_code:code,created_at:'2026-01-01'},pet:{name:'Cocoa'},members:[{user_id:profile.id,display_name:'A',initials:null,avatar_url:null,joined_at:'2026-01-01'}]});
assert.equal(duo.brownieName,'Cocoa');assert.equal(duo.members[0].userId,profile.id);assert.equal(onboardingStep(profile,duo),'waiting');
assert.equal(onboardingStep(profile,{...duo,members:[...duo.members,{...duo.members[0],userId:'partner-id'}]}),'ready');
assert.throws(()=>duoFromJson({duo:{},pet:{},members:[]}));
console.log('Backend adapters, guards, invite format, timezone and DST tests passed.');

const {confirmationRequest,confirmationIssue,confirmationMessage}=require('./lib/auth/confirmation.ts');
assert.deepEqual(confirmationRequest(new URLSearchParams('token_hash=test&type=email')),{kind:'token',tokenHash:'test',type:'email'});
assert.equal(confirmationRequest(new URLSearchParams('token_hash=test&type=signup')).kind,'token');
assert.equal(confirmationRequest(new URLSearchParams('code=test')).kind,'code');
for(const input of ['', 'token_hash=test&type=recovery','token_hash=test&type=magiclink','token_hash=test&code=test&type=email']) assert.equal(confirmationRequest(new URLSearchParams(input)).kind,'error');
assert.equal(confirmationRequest(new URLSearchParams('error_code=otp_expired')).issue,'expired');
assert.equal(confirmationIssue('bad_code_verifier'),'pkce');
assert.match(confirmationMessage('expired'),/fresh confirmation email/);
console.log('One-member waiting, two-member ready, and confirmation flow regression checks passed.');

const {canonicalValue,displayValue,goalStateFromRows,mergeCheckIn}=require('./lib/repositories/goal-adapters.ts');
const {selectGoals}=require('./lib/goal-state.ts');
const {goalProgress,isGoalComplete}=require('./lib/goal-data.ts');
assert.equal(canonicalValue(2.5,'duration','hrs'),9000);
assert.equal(displayValue(1800,'duration','min'),30);
const goalRow={id:'goal-1',duo_id:'duo-1',owner_user_id:null,scope:'shared',name:'Study',icon_key:'study',tracking_type:'measured',measurement_kind:'duration',unit:'seconds',display_unit:'hrs',status:'active',created_by:'user-a',notes:null,created_at:'2026-01-01',updated_at:'2026-01-01',archived_at:null};
const assignments=[
  {id:'a1',goal_id:'goal-1',user_id:'user-a',target_value:14400,canonical_unit:'seconds',active_from:'2026-01-01',active_until:'2026-01-03',created_at:'2026-01-01'},
  {id:'a1-next',goal_id:'goal-1',user_id:'user-a',target_value:18000,canonical_unit:'seconds',active_from:'2026-01-03',active_until:null,created_at:'2026-01-02'},
  {id:'a2',goal_id:'goal-1',user_id:'user-b',target_value:10800,canonical_unit:'seconds',active_from:'2026-01-01',active_until:null,created_at:'2026-01-01'},
];
const checkIn={id:'c1',goal_id:'goal-1',user_id:'user-a',assignment_id:'a1',local_date:'2026-01-02',value:9000,tracking_snapshot:'measured',target_snapshot:14400,unit_snapshot:'seconds',completed:false,created_at:'2026-01-02',updated_at:'2026-01-02'};
const hydrated=goalStateFromRows([goalRow],assignments,[checkIn],'2026-01-02');
const projected=selectGoals(hydrated)[0];
assert.equal(projected.targets[0].target,4); assert.equal(projected.targets[0].currentValue,2.5);
assert.equal(projected.targets[0].nextTarget,5); assert.equal(projected.targets[0].nextTargetFrom,'2026-01-03');
assert.equal(goalProgress(projected,projected.targets[0]),63); assert.equal(isGoalComplete(projected,projected.targets[0]),false);
const friendRow={...checkIn,id:'c2',user_id:'user-b',assignment_id:'a2',value:10800,target_snapshot:10800,completed:true};
const merged=selectGoals(mergeCheckIn(hydrated,friendRow,'upsert'))[0];
assert.equal(merged.targets[1].currentValue,3); assert.equal(isGoalComplete(merged,merged.targets[1]),true);
assert.equal(selectGoals(mergeCheckIn(mergeCheckIn(hydrated,friendRow,'upsert'),{...friendRow,value:3600},'upsert'))[0].targets[1].currentValue,1);
console.log('Goal adapters, duration conversion, snapshot hydration, normalized completion, and realtime key merge tests passed.');
