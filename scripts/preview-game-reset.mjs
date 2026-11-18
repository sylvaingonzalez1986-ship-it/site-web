// Read-only inventory for the requested game reset. No mutation RPC is called.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

if (process.argv.slice(2).length) throw new Error('This command accepts no options and cannot apply a reset.');
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase configuration is missing.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const result = { observedAt: new Date().toISOString(), readOnly: true, counts: {}, incomplete: false };
async function count(label, table, filter) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const response = await query.abortSignal(AbortSignal.timeout(15000));
  if (response.error) {
    result.incomplete = true;
    // Do not expose credentials, URLs, row contents or provider error details.
    result.counts[label] = { unavailable: true, code: response.error.code || 'connection_unavailable' };
  } else {
    result.counts[label] = response.count;
  }
}
for (const table of [
  'kq_equipment_wallets', 'kq_pioneer_pack_grants', 'kq_runs', 'kq_flowers',
  'contest_reviews', 'contest_tester_points', 'contest_profile_badges',
  'arena_feedback', 'lottery_card_instances', 'kq_support_booster_entitlements',
]) await count(table, table);
for (const source of [
  'ticket', 'arena_streak', 'notebook_badge', 'season_reward', 'points_purchase',
  'welcome_pack', 'pvp_win', 'notebook_flower', 'mission', 'achievement',
  'pioneer_pack', 'contest_bundle', 'arena_feedback',
]) await count(`boosters:${source}`, 'kq_support_booster_entitlements', query => query.eq('source', source));
for (const column of ['source_bot_battle_id', 'game_mission_reward_id', 'pioneer_grant_id']) {
  await count(`cards:${column}`, 'lottery_card_instances', query => query.not(column, 'is', null));
}
console.log(JSON.stringify(result, null, 2));
if (result.incomplete) process.exitCode = 1;
