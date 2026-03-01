import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

async function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

function toText(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  return fallback;
}

function toInt(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const docsPath = path.join(ROOT, "docs", "lottery", "hemp-heroes-2026-cards.json");
  const raw = await fs.readFile(docsPath, "utf8");
  const cards = JSON.parse(raw.replace(/^\uFEFF/, ""));

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("No cards found in docs/lottery/hemp-heroes-2026-cards.json");
  }

  const collectionCode = "HEMP_HEROES_2026";
  const collectionTitle = process.env.LOTTERY_COLLECTION_TITLE || "Hemp Heroes 2026 Collection";

  const upsertCollection = await supabase
    .from("lottery_card_collections")
    .upsert(
      {
        code: collectionCode,
        title: collectionTitle,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();

  if (upsertCollection.error || !upsertCollection.data) {
    throw new Error(`Upsert collection failed: ${upsertCollection.error?.message ?? "unknown error"}`);
  }

  const collectionId = upsertCollection.data.id;

  const existingResult = await supabase
    .from("lottery_card_definitions")
    .select("code,image_url")
    .eq("collection_id", collectionId);

  if (existingResult.error) {
    throw new Error(`Load existing cards failed: ${existingResult.error.message}`);
  }

  const existingImageByCode = new Map(
    (existingResult.data ?? []).map((row) => [toText(row.code).toUpperCase(), toText(row.image_url)]),
  );

  const rows = cards.map((card) => ({
    code: toText(card.code).toUpperCase(),
    card_number: toInt(card.cardNumber, 1),
    name: toText(card.name),
    rarity: toText(card.rarity, "common"),
    visual_prompt: toText(card.visualPrompt),
    description: toText(card.description),
    image_url: (() => {
      const nextCode = toText(card.code).toUpperCase();
      const sourceImage = toText(card.imageUrl);
      if (sourceImage) return sourceImage;
      return toText(existingImageByCode.get(nextCode));
    })(),
    is_active: card?.isActive !== false,
    updated_at: new Date().toISOString(),
    collection_id: collectionId,
  }));

  const upsertCards = await supabase
    .from("lottery_card_definitions")
    .upsert(rows, { onConflict: "code" })
    .select("id,code,is_active");

  if (upsertCards.error) {
    throw new Error(`Upsert cards failed: ${upsertCards.error.message}`);
  }

  const activeResult = await supabase
    .from("lottery_card_definitions")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collectionId)
    .eq("is_active", true);

  if (activeResult.error) {
    throw new Error(`Count active cards failed: ${activeResult.error.message}`);
  }

  console.log(`Restored cards successfully.`);
  console.log(`Collection ID: ${collectionId}`);
  console.log(`Upserted rows: ${upsertCards.data?.length ?? 0}`);
  console.log(`Active cards in collection: ${activeResult.count ?? 0}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
