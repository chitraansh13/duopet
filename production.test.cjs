const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=(path)=>fs.readFileSync(path,'utf8');

for(const path of ['app/(app)/page.tsx','components/challenges/ChallengeProvider.tsx','components/challenges/ChallengesDashboard.tsx','components/progress/ProgressDashboard.tsx','components/pet/PetDashboard.tsx']){
  const source=read(path);
  assert.doesNotMatch(source,/from ["']@\/lib\/(mock-data|progress-data|challenge-data)["'].*mock/i,`${path} must not load production fixtures`);
  assert.doesNotMatch(source,/mockGoals|mockChallenges/,`${path} must not use demo records`);
}
assert.match(read('lib/data-source.ts'),/DUOPET_DATA_MODE === "demo"/);
assert.match(read('components/progress/ProgressDashboard.tsx'),/Your progress will appear here as you build your rhythm/);
assert.match(read('lib/progress-history.ts'),/checkIns\.filter\(\(row\) => Number\(row\.value\) > 0 \|\| Boolean\(row\.completed\)\)/);
assert.match(read('components/progress/DuoHeatmap.tsx'),/No activity recorded for this day/);
assert.match(read('components/challenges/ChallengesDashboard.tsx'),/No challenges yet/);
assert.match(read('components/pet/PetActivityFeed.tsx'),/waiting for your first win today/);
assert.match(read('components/tasks/TaskDetail.tsx'),/loadTaskHistory/);
assert.match(read('components/pet/PetDashboard.tsx'),/runtime\.companion\.unlockedItems\.includes/);
assert.match(read('components/profile/ProfileDashboard.tsx'),/runtime\.companion\.unlockedItems\.includes/);
assert.doesNotMatch(read('components/AppShell.tsx'),/mock-data/);
const form=read('components/tasks/GoalForm.tsx');
for(const expected of ['Saving…','readOnly','Starting tomorrow','Apply new target','pending||saving'])assert.ok(form.includes(expected),`Goal save UX missing ${expected}`);
const provider=read('components/goals/GoalProvider.tsx');
for(const expected of ['mutationLock.current','Saved — updated for today','Saved — new target starts tomorrow','Goal updated','table: "goal_assignments"'])assert.ok(provider.includes(expected),`Goal provider missing ${expected}`);
const profile=read('components/SessionProvider.tsx');
for(const expected of ['savingRef.current','Changes saved','role="status"'])assert.ok(profile.includes(expected),`Profile save UX missing ${expected}`);
console.log('Production boundary, empty states, target realtime, and save-feedback checks passed.');
