import "server-only";

import { KQ_CARDS } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const COLLECTION_CODE = "BOTTE_DU_CHANVRIER_2026";
const ALLOWED_RARITIES = new Set(["common", "silver", "gold"]);

export async function getKqBotteCatalogAdmin() {
  const client = createSupabaseServiceClient();
  const collectionResult = await client.from("lottery_card_collections")
    .select("id,code,title,description,image_url,is_active").eq("code", COLLECTION_CODE).single();
  if (collectionResult.error) throw new Error(`[data:botte-collection] ${collectionResult.error.message}`);
  const cardsResult = await client.from("lottery_card_definitions")
    .select("id,code,card_number,name,rarity,description,image_url,is_active")
    .eq("collection_id", collectionResult.data.id).order("card_number", { ascending: true });
  if (cardsResult.error) throw new Error(`[data:botte-cards] ${cardsResult.error.message}`);
  const cardIds = (cardsResult.data ?? []).map((card) => String(card.id));
  const rulesResult = cardIds.length
    ? await client.from("kq_support_card_rules")
        .select("card_definition_id,category,timing,effect,xp_cost,tags,targets,advantage,drawback,rules_version")
        .in("card_definition_id", cardIds)
    : { data: [], error: null };
  if (rulesResult.error) throw new Error(`[data:botte-rules] ${rulesResult.error.message}`);
  const ruleByCardId = new Map((rulesResult.data ?? []).map((rule) => [String(rule.card_definition_id), rule]));
  const heritageResult = await client.from("kq_heritage_card_definitions")
    .select("code,name,timing,effect_code,description,image_url,is_active,advantage,drawback")
    .order("code", { ascending: true });
  if (heritageResult.error) throw new Error(`[data:heritage-cards] ${heritageResult.error.message}`);
  return {
    collection: {
      code: String(collectionResult.data.code), title: String(collectionResult.data.title),
      description: String(collectionResult.data.description ?? ""), imageUrl: String(collectionResult.data.image_url ?? ""),
      isActive: collectionResult.data.is_active === true,
    },
    cards: (cardsResult.data ?? []).map((card) => {
      const rule = ruleByCardId.get(String(card.id));
      return {
        id: String(card.id), code: String(card.code), cardNumber: Number(card.card_number), name: String(card.name),
        rarity: String(card.rarity), description: String(card.description), imageUrl: String(card.image_url ?? ""),
        isActive: card.is_active === true,
        category: String(rule?.category ?? "equipment"), timing: String(rule?.timing ?? "before-roll"),
        effect: String(rule?.effect ?? "reroll-neutral"), xpCost: Number(rule?.xp_cost ?? 0),
        tags: Array.isArray(rule?.tags) ? rule.tags.map(String) : [], targets: Array.isArray(rule?.targets) ? rule.targets.map(String) : [],
        advantage: String(rule?.advantage ?? card.description), drawback: String(rule?.drawback ?? ""),
        rulesVersion: Number(rule?.rules_version ?? 1),
      };
    }),
    supportedEffects: [...new Set(KQ_CARDS.map((card) => card.effect))],
    heritages: (heritageResult.data ?? []).map((card) => ({
      code: String(card.code), name: String(card.name), timing: String(card.timing),
      effect: String(card.effect_code), description: String(card.description), imageUrl: String(card.image_url ?? ""),
      isActive: card.is_active === true, advantage: String(card.advantage ?? card.description),
      drawback: String(card.drawback ?? ""),
    })),
  };
}

function cleanText(value: string, max: number) { return value.trim().slice(0, max); }

export async function updateKqBotteCollection(input: { title: string; description: string; imageUrl: string; isActive: boolean }) {
  const title = cleanText(input.title, 120);
  if (title.length < 3) throw new Error("Nom de collection invalide.");
  const client = createSupabaseServiceClient();
  const result = await client.from("lottery_card_collections").update({
    title, description: cleanText(input.description, 1000), image_url: cleanText(input.imageUrl, 2000),
    is_active: input.isActive, updated_at: new Date().toISOString(),
  }).eq("code", COLLECTION_CODE).select("code").single();
  if (result.error) throw new Error(`[data:update-botte-collection] ${result.error.message}`);
  return { saved: true };
}

export async function updateKqBotteCard(input: {
  cardId: string; name: string; rarity: string; description: string; imageUrl: string; isActive: boolean;
  advantage: string; drawback: string;
}) {
  const name = cleanText(input.name, 120);
  const advantage = cleanText(input.advantage, 500);
  if (!/^[0-9a-f-]{36}$/i.test(input.cardId) || name.length < 3 || advantage.length < 3 || !ALLOWED_RARITIES.has(input.rarity)) {
    throw new Error("Carte La Botte invalide.");
  }
  const client = createSupabaseServiceClient();
  const definition = await client.from("lottery_card_definitions").select("id,code")
    .eq("id", input.cardId).like("code", "BOTTE-%").single();
  if (definition.error) throw new Error("Carte La Botte introuvable.");
  if (!KQ_CARDS.some((card) => card.code === definition.data.code)) throw new Error("Règle de carte non prise en charge.");
  const update = await client.rpc("rpc_kq_update_botte_card_editorial", {
    p_card_id: input.cardId, p_name: name, p_rarity: input.rarity,
    p_description: cleanText(input.description, 500), p_image_url: cleanText(input.imageUrl, 2000),
    p_is_active: input.isActive, p_advantage: advantage, p_drawback: cleanText(input.drawback, 500),
  });
  if (update.error) throw new Error(`[data:update-botte-card] ${update.error.message}`);
  return { saved: true };
}

export async function updateKqHeritageCard(input: {
  code: string; name: string; description: string; imageUrl: string; isActive: boolean;
  advantage: string; drawback: string;
}) {
  const code = input.code.trim();
  const name = cleanText(input.name, 120);
  const advantage = cleanText(input.advantage, 500);
  if (!/^HERITAGE-[0-9]{3}$/.test(code) || name.length < 3 || advantage.length < 3
    || !KQ_HERITAGE_CARDS.some((card) => card.code === code)) {
    throw new Error("Carte Héritage invalide.");
  }
  const client = createSupabaseServiceClient();
  const update = await client.rpc("rpc_kq_update_heritage_card_editorial", {
    p_code: code, p_name: name,
    p_description: cleanText(input.description, 500), p_image_url: cleanText(input.imageUrl, 2000),
    p_is_active: input.isActive, p_advantage: advantage, p_drawback: cleanText(input.drawback, 500),
  });
  if (update.error) throw new Error(`[data:update-heritage-card] ${update.error.message}`);
  return { saved: true };
}
