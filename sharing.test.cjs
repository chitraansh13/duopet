const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

const source = readFileSync('lib/sharing.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const functions = {};
new Function('exports', 'require', js)(functions, require);
const { redactPartnerGoals, clearPrivateRuntime } = functions;

const own = { id: 'mine', scope: 'personal', createdBy: 'a', progressSource: 'manual' };
const partner = { id: 'theirs', scope: 'personal', createdBy: 'b', progressSource: 'manual' };
const food = { id: 'food', scope: 'shared', createdBy: 'a', progressSource: 'food_protein' };
const state = { date: '2026-09-25', definitions: [own, partner, food], checkIns: [
  { goalId: 'mine', userId: 'a', date: '2026-09-25', value: 1 },
  { goalId: 'theirs', userId: 'b', date: '2026-09-25', value: 1 },
  { goalId: 'food', userId: 'a', date: '2026-09-25', value: 20 },
  { goalId: 'food', userId: 'b', date: '2026-09-25', value: 30 },
] };
const allowed = { share_personal_goals: true, share_food_diary: true, share_nutrition_totals: true };
assert.equal(redactPartnerGoals(state, 'b', allowed).checkIns.length, 4);
const revoked = redactPartnerGoals(state, 'b', { ...allowed, share_personal_goals: false, share_nutrition_totals: false });
assert.deepEqual(revoked.definitions.map((goal) => goal.id), ['mine', 'food']);
assert.deepEqual(revoked.checkIns.map((row) => row.userId), ['a', 'a']);
assert.equal(state.checkIns.length, 4, 'source state remains immutable');

const runtime = { isDemoMode: false, companion: { activities: [{ id: 'private' }] },
  challenges: [{ id: 'private' }], progress: { hasHistory: true, habits: [{ id: 'private' }], heatmap: [{ date: '2026-09-25' }], summaries: {} } };
const cleared = clearPrivateRuntime(runtime);
assert.deepEqual(cleared.companion.activities, []);
assert.deepEqual(cleared.challenges, []);
assert.deepEqual(cleared.progress.habits, []);
assert.deepEqual(cleared.progress.heatmap, []);
assert.equal(cleared.progress.hasHistory, false);
console.log('Partner privacy cache-redaction checks passed.');
