/** Grant the limited edition to every eligible account; safe to run repeatedly. */
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const unknown = process.argv.slice(2).filter(value => !['--apply', '--help'].includes(value));
if (unknown.length) throw new Error('Unknown option. Use --help for usage.');
if (process.argv.includes('--help')) {
  console.log('node scripts/grant-pioneer-packs.mjs          Preview eligible accounts (no credits).\nnode scripts/grant-pioneer-packs.mjs --apply  Credit all eligible accounts once.\nRun again after 10 October 2026 for final distribution.');
  process.exit(0);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Supabase service credentials are required.');
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const totals = { processed: 0, eligible: 0, granted: 0, alreadyGranted: 0, unavailable: 0 };
let cursor = null;
console.log(apply ? 'Distribution des Packs des Pionniers.' : 'Aperçu : aucun crédit ne sera effectué.');
do {
  const { data, error } = await client.rpc('rpc_kq_pioneer_pack_batch', { p_after: cursor, p_limit: 100, p_apply: apply });
  if (error) throw new Error(`Distribution interrupted (${error.code || 'database unavailable'}). Check that the pioneer migration is installed; rerunning is safe.`);
  if (!data || typeof data.processed !== 'number' || !('nextCursor' in data)) throw new Error('Unexpected batch response; distribution stopped.');
  for (const key of Object.keys(totals)) totals[key] += data[key];
  if (data.nextCursor && data.nextCursor === cursor) throw new Error('Batch cursor did not advance; distribution stopped.');
  cursor = data.nextCursor;
  console.log(JSON.stringify(totals));
} while (cursor);
if (totals.unavailable > 0) {
  console.error('Certains packs restent en attente : vérifier les collections Buddies / La Botte avant de relancer.');
  process.exitCode = 1;
}
