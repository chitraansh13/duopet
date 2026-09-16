import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
// Write only after success; a failed CLI call must never empty the existing contract.
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['supabase','gen','types','typescript','--linked','--schema','public'], { encoding:'utf8', shell:process.platform==='win32' });
if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error(result.stderr || result.error?.message || 'Type generation failed.');
  process.exit(1);
}
writeFileSync('lib/supabase/database.types.ts', result.stdout);
console.log('Database types regenerated. Run npm run typecheck and npm test.');
