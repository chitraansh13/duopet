const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(
  fs.readFileSync(filename,'utf8').replaceAll('"@/lib/','"./'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}
).outputText,filename);
const {buildProgress}=require('./lib/progress-history.ts');

const today='2026-09-23';
const duo={id:'duo',timezone:'UTC',members:[{userId:'a'},{userId:'b'}]};
const stats={total_xp:0,perfect_days:0,current_streak:0,best_streak:0};
const empty=buildProgress([],[],[],[],[],stats,duo,'a',today);
assert.equal(empty.hasHistory,false);
assert.deepEqual(empty.habits,[]);
assert.equal(empty.summaries.week.you,0);
assert.equal(empty.insightsReady,false);
assert.equal(empty.heatmap.length,42);
assert.equal(empty.heatmap[0].date,'2026-08-17');
assert.equal(empty.heatmap.at(-1).future,true);
assert.equal(empty.heatmap.find(day=>day.date===today).future,undefined);

const goal={id:'study',created_at:'2026-09-21T00:00:00Z',archived_at:null,status:'active',scope:'shared',name:'Study',icon_key:'study'};
const assignments=[
  {goal_id:'study',user_id:'a',active_from:'2026-09-21',active_until:'2026-09-22',target_value:10800},
  {goal_id:'study',user_id:'a',active_from:'2026-09-22',active_until:null,target_value:14400},
  {goal_id:'study',user_id:'b',active_from:'2026-09-21',active_until:null,target_value:7200},
];
const checkIns=[
  {goal_id:'study',user_id:'a',local_date:'2026-09-21',value:10800,target_snapshot:10800,completed:true},
  {goal_id:'study',user_id:'b',local_date:'2026-09-21',value:7200,target_snapshot:7200,completed:true},
  {goal_id:'study',user_id:'a',local_date:'2026-09-22',value:10800,target_snapshot:14400,completed:false},
  {goal_id:'study',user_id:'b',local_date:'2026-09-22',value:7200,target_snapshot:7200,completed:true},
];
const events=[{source_type:'perfect_day',local_date:'2026-09-21',reversed_at:null}];
const statuses=[{goal_id:'study',effective_date:'2026-09-21',status:'active'}];
const progress=buildProgress([goal],assignments,checkIns,events,statuses,{...stats,current_streak:0,best_streak:1},duo,'a',today);
assert.equal(progress.hasHistory,true);
assert.equal(progress.summaries.week.you,33);
assert.equal(progress.summaries.week.friend,67);
assert.equal(progress.habits[0].rates.week.you,33);
assert.equal(progress.habits[0].rates.week.friend,67);
assert.equal(progress.heatmap.find(day=>day.date==='2026-09-21').perfect,true);
assert.equal(progress.heatmap.find(day=>day.date==='2026-09-22').perfect,false);
assert.equal(progress.summaries.week.perfectDays,1);
assert.equal(progress.insightsReady,false);

const archived=buildProgress([{...goal,status:'archived',archived_at:'2026-09-23T00:00:00Z'}],assignments,checkIns,events,
  [...statuses,{goal_id:'study',effective_date:'2026-09-23',status:'archived'}],stats,duo,'a',today);
assert.equal(archived.summaries.week.you,50);
assert.equal(archived.summaries.week.friend,100);
assert.equal(archived.heatmap.find(day=>day.date===today).applicable,false);
assert.equal(archived.habits.length,1);

const paused=buildProgress([goal],assignments,checkIns,events,
  [...statuses,{goal_id:'study',effective_date:'2026-09-22',status:'paused'}],stats,duo,'a',today);
assert.equal(paused.summaries.week.you,50);
assert.equal(paused.summaries.week.friend,100);
const sameDayArchive=buildProgress([{...goal,status:'archived',archived_at:'2026-09-22T18:00:00Z'}],assignments,checkIns,events,
  [...statuses,{goal_id:'study',effective_date:'2026-09-22',status:'archived'}],stats,duo,'a',today);
assert.equal(sameDayArchive.summaries.week.you,50);
assert.equal(sameDayArchive.heatmap.find(day=>day.date==='2026-09-22').applicable,true);
console.log('Phase 3 progress history, target snapshots, lifecycle, calendar, and empty-state checks passed.');
