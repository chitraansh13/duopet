const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=(path)=>fs.readFileSync(path,'utf8');
const manifestExports={};
new Function('exports',ts.transpileModule(read('app/manifest.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(manifestExports);
const manifest=manifestExports.default();
assert.equal(manifest.name,'DuoPet');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'/');
for(const size of [192,512]){
  assert.ok(manifest.icons.some((icon)=>icon.src===`/icon-${size}.png`&&icon.sizes===`${size}x${size}`));
  const png=fs.readFileSync(`public/icon-${size}.png`);
  assert.equal(png.readUInt32BE(16),size);
  assert.equal(png.readUInt32BE(20),size);
}
assert.equal(fs.readFileSync('public/apple-touch-icon.png').readUInt32BE(16),180);
assert.match(read('app/layout.tsx'),/apple: "\/apple-touch-icon\.png"/);
const proxy=read('proxy.ts');
for(const publicPath of ['login','signup','reset-password','auth/confirm','manifest.webmanifest','apple-touch-icon.png','icon-192.png','icon-512.png'])
  assert.ok(proxy.includes(publicPath),`Public route/asset should bypass session refresh: ${publicPath}`);

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
