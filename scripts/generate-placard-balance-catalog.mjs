// Reproducible catalog migration; no database connection or environment secrets.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
try {
  const { KQ_CARDS, KQ_RETIRED_CARDS, KQ_BUDDIES, getKqCardTradeoff } = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const { KQ_GAME_EQUIPMENT_PRICES } = await vite.ssrLoadModule("/src/lib/kanab-quest-equipment.ts");
  const sql = (text) => "'" + text.replaceAll("'", "''") + "'";
  const effects = [...new Set([...KQ_CARDS, ...KQ_RETIRED_CARDS].map((card) => card.effect).concat(["compost-buffer", "safe-neutral-reroll", "three-to-success"]))];
  let migration = `BEGIN;
ALTER TABLE public.kq_support_card_rules DROP CONSTRAINT IF EXISTS kq_support_card_rules_effect_check;
ALTER TABLE public.kq_support_card_rules ADD CONSTRAINT kq_support_card_rules_effect_check CHECK (effect IN (${effects.map(sql).join(", ")}));
`;
  for (const card of KQ_CARDS) {
    const tradeoff = getKqCardTradeoff(card);
    migration += `
UPDATE public.lottery_card_definitions SET description = ${sql(card.description)}, updated_at = now() WHERE code = ${sql(card.code)};
`;
    migration += `UPDATE public.kq_support_card_rules SET effect = ${sql(card.effect)}, timing = ${sql(card.timing)}, xp_cost = ${card.xpCost}, advantage = ${sql(tradeoff.benefit)}, drawback = ${sql(tradeoff.risk)}, rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = ${sql(card.code)});
`;
  }
  for (const card of KQ_BUDDIES) migration += `
UPDATE public.lottery_card_definitions SET description = ${sql(card.ability)}, updated_at = now() WHERE code = ${sql(card.code)};
`;
  for (const [code, price] of Object.entries(KQ_GAME_EQUIPMENT_PRICES)) migration += `
UPDATE public.kq_equipment_catalog SET price_cents = ${price} WHERE code = ${sql(code)};
`;
  await writeFile("supabase/migrations/20260912000300_kq_distinct_talents.sql", migration + `
COMMIT;
`);
} finally { await vite.close(); }
