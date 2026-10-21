import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import producerHeritages from "@/data/producer-heritage-cards.json";
import { KQ_HERITAGE_EFFECT_TEMPLATES } from "@/lib/kanab-quest-heritage";

const owner = "11111111-1111-4111-8111-111111111111";
const retired = [
  { code: "HERITAGE-013", producerId: "producer-1773871212890-5816", producerName: "Cannapache", effect: "flower-neutrals-to-success" },
  { code: "HERITAGE-014", producerId: "producer-1773871368477-5738", producerName: "Cap Estuaire", effect: "drying-lowest-to-spark" },
  { code: "HERITAGE-015", producerId: "producer-1773872025906-6885", producerName: "Skud Farm", effect: "dangers-to-success" },
];
const sql = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");
let db: PGlite;
let drawsBefore: unknown[];
let cultureBefore: unknown[];
let otherDefinitionsBefore: unknown[];
let otherEffectsBefore: unknown[];
let otherDefinitionsAfter: unknown[];
let otherEffectsAfter: unknown[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.producers(id TEXT PRIMARY KEY, name TEXT NOT NULL, image TEXT DEFAULT '');
    CREATE TABLE public.kq_heritage_card_definitions(
      code TEXT PRIMARY KEY, name TEXT NOT NULL, rarity TEXT NOT NULL DEFAULT 'common',
      timing TEXT NOT NULL, effect_code TEXT NOT NULL, description TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT TRUE,
      advantage TEXT NOT NULL DEFAULT '', drawback TEXT NOT NULL DEFAULT '',
      producer_id TEXT REFERENCES public.producers(id), producer_name TEXT NOT NULL DEFAULT '',
      producer_image TEXT NOT NULL DEFAULT '', auto_managed BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX uq_kq_heritage_definition_producer
      ON public.kq_heritage_card_definitions(producer_id) WHERE producer_id IS NOT NULL;
    CREATE TABLE public.kq_producer_reward_campaigns(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), producer_id TEXT REFERENCES public.producers(id),
      heritage_code TEXT REFERENCES public.kq_heritage_card_definitions(code),
      status TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE public.kq_heritage_draws(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
      card_code TEXT NOT NULL REFERENCES public.kq_heritage_card_definitions(code),
      drawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE public.kq_runs(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, state JSONB NOT NULL,
      heritage_code TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE public.arena_chanvrier_profiles(user_id UUID PRIMARY KEY, strength TEXT NOT NULL);
    CREATE SEQUENCE public.kq_heritage_card_number_seq START 21;
    CREATE FUNCTION public.rpc_kq_start_run(
      p_user_id UUID, p_buddie_code TEXT, p_seed INTEGER, p_deck_codes TEXT[],
      p_scenario_codes TEXT[], p_initial_state JSONB, p_culture_tokens INTEGER
    ) RETURNS JSONB LANGUAGE plpgsql AS $$
    DECLARE run public.kq_runs%ROWTYPE;
    BEGIN
      IF (p_initial_state->>'xp')::INTEGER <> 1 + p_culture_tokens THEN
        RAISE EXCEPTION 'base_xp_mismatch';
      END IF;
      INSERT INTO public.kq_runs(user_id, state) VALUES(p_user_id, p_initial_state) RETURNING * INTO run;
      RETURN jsonb_build_object('run', to_jsonb(run));
    END $$;
  `);
  const cards = [
    ...producerHeritages.cards.filter(card => !retired.some(old => old.code === card.code)),
    ...retired.map(card => ({ ...card, name: card.producerName, timing: "once-per-run" })),
  ];
  for (const card of cards) {
    await db.query("INSERT INTO public.producers(id,name) VALUES($1,$2)", [card.producerId, card.producerName]);
    await db.query(`INSERT INTO public.kq_heritage_card_definitions(
      code,name,timing,effect_code,description,advantage,producer_id,producer_name
    ) VALUES($1,$2,$3,$4,'Ancien avantage','Ancien avantage',$5,$6)`, [
      card.code, card.name, card.code === "HERITAGE-020" ? "once-per-run" : card.timing,
      card.code === "HERITAGE-020" ? "growth-danger-reroll" : card.effect, card.producerId, card.producerName,
    ]);
    await db.query("INSERT INTO public.kq_producer_reward_campaigns(producer_id,heritage_code,status) VALUES($1,$2,'active')", [card.producerId, card.code]);
    await db.query("INSERT INTO public.kq_heritage_draws(user_id,card_code) VALUES($1,$2)", [owner, card.code]);
  }
  await db.query("INSERT INTO public.kq_runs(user_id,heritage_code,state) VALUES($1,'HERITAGE-013',$2)", [
    owner, { heritageCode: "HERITAGE-013", heritageName: "Canopée attentive", xp: 5, stageIndex: 2 },
  ]);
  await db.exec(sql("20260906000600_kq_expand_unique_heritage_effects.sql"));
  const dynamic = sql("20260906000500_kq_dynamic_producer_heritages.sql");
  const startFunction = dynamic.slice(
    dynamic.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage("),
    dynamic.indexOf("CREATE OR REPLACE FUNCTION public.kq_protect_run_heritage_identity()"),
  );
  await db.exec(startFunction);
  await db.exec(`
    REVOKE ALL ON FUNCTION public.rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT)
      TO service_role;
  `);
  const chanvrier = sql("20260914000100_arena_chanvrier_profiles.sql");
  await db.exec(chanvrier.slice(
    chanvrier.indexOf("-- Extend the existing rare-Buddie/heritage validation"),
    chanvrier.indexOf("-- Add the immutable specialty"),
  ));
  drawsBefore = (await db.query("SELECT * FROM public.kq_heritage_draws ORDER BY card_code")).rows;
  cultureBefore = (await db.query("SELECT * FROM public.kq_runs")).rows;
  await db.exec(sql("20261011160000_kq_heritage_culture_refresh.sql"));
  await db.query(`INSERT INTO public.kq_heritage_card_definitions(
    code,name,timing,effect_code,description,advantage,drawback,image_url,is_active,auto_managed
  ) VALUES('HERITAGE-901','Nom personnalisé','once-per-run','opening-hand-reserve',
    'Ancien texte personnalisé','Ancien avantage','Usage personnalisé','/custom/heritage.webp',FALSE,FALSE)`);
  otherDefinitionsBefore = (await db.query("SELECT * FROM public.kq_heritage_card_definitions WHERE effect_code<>'opening-hand-reserve' ORDER BY code")).rows;
  otherEffectsBefore = (await db.query("SELECT * FROM public.kq_heritage_effect_catalog WHERE effect_code<>'opening-hand-reserve' ORDER BY effect_code")).rows;
  await db.exec(sql("20261020000300_kq_ten_card_hand.sql"));
  otherDefinitionsAfter = (await db.query("SELECT * FROM public.kq_heritage_card_definitions WHERE effect_code<>'opening-hand-reserve' ORDER BY code")).rows;
  otherEffectsAfter = (await db.query("SELECT * FROM public.kq_heritage_effect_catalog WHERE effect_code<>'opening-hand-reserve' ORDER BY effect_code")).rows;
}, 30000);

afterAll(async () => { await db?.close(); });

type CardRow = { code: string; name: string; timing: string; effect_code: string; producer_name: string; image_url: string };

async function start(code: string | null, xp: number, tokens = 0, buddie = "HH2026-030") {
  const card = code
    ? (await db.query<CardRow>("SELECT * FROM public.kq_heritage_card_definitions WHERE code=$1", [code])).rows[0]
    : null;
  const state = {
    xp,
    ...(card ? {
      heritageCode: card.code, heritageName: card.name, heritageTiming: card.timing,
      heritageEffect: card.effect_code, heritageProducerName: card.producer_name,
      heritageImageUrl: card.image_url, heritageUsed: false, heritageArmed: false,
    } : {}),
  };
  const result = await db.query<{ result: { run: { state: typeof state } } }>(
    "SELECT public.rpc_kq_start_run_with_heritage($1,$2,42,ARRAY[]::TEXT[],ARRAY[]::TEXT[],$3,$4,$5) AS result",
    [owner, buddie, state, tokens, code],
  );
  return result.rows[0].result.run.state;
}

describe("Heritage culture refresh migration", () => {
  it("retires the three partnerships while preserving owned cards, producers and cultures", async () => {
    expect((await db.query("SELECT * FROM public.kq_heritage_draws ORDER BY card_code")).rows).toEqual(drawsBefore);
    expect((await db.query("SELECT * FROM public.kq_runs")).rows).toEqual(cultureBefore);
    for (const card of retired) {
      expect((await db.query("SELECT is_active FROM public.kq_heritage_card_definitions WHERE code=$1", [card.code])).rows).toEqual([{ is_active: false }]);
      expect((await db.query("SELECT status FROM public.kq_producer_reward_campaigns WHERE heritage_code=$1", [card.code])).rows).toEqual([{ status: "archived" }]);
      expect((await db.query("SELECT id FROM public.producers WHERE id=$1", [card.producerId])).rows).toHaveLength(1);
      await expect(db.query("UPDATE public.kq_heritage_card_definitions SET is_active=TRUE WHERE code=$1", [card.code])).rejects.toThrow("kq_retired_producer_heritages_inactive");
      await expect(db.query("UPDATE public.kq_producer_reward_campaigns SET status='active' WHERE heritage_code=$1", [card.code])).rejects.toThrow("kq_retired_producer_campaigns_inactive");
      await expect(start(card.code, 3)).rejects.toThrow("kq_heritage_inactive");
      const synced = await db.query<{ is_active: boolean }>("SELECT is_active FROM public.kq_ensure_producer_heritage($1)", [card.producerId]);
      expect(synced.rows[0].is_active).toBe(false);
    }
  });

  it("persists all 25 effect descriptions and the complete playable producer manifest", async () => {
    for (const template of KQ_HERITAGE_EFFECT_TEMPLATES) {
      expect((await db.query("SELECT timing,default_name,default_description,default_drawback FROM public.kq_heritage_effect_catalog WHERE effect_code=$1", [template.effect])).rows).toEqual([{
        timing: template.timing, default_name: template.name,
        default_description: template.description, default_drawback: template.drawback,
      }]);
    }
    expect((await db.query("SELECT code FROM public.kq_heritage_card_definitions WHERE is_active=TRUE")).rows).toHaveLength(producerHeritages.cards.length);
    for (const card of producerHeritages.cards) {
      expect((await db.query("SELECT producer_id,name,effect_code,timing,description,advantage,drawback,image_url,is_active FROM public.kq_heritage_card_definitions WHERE code=$1", [card.code])).rows).toEqual([{
        producer_id: card.producerId, name: card.name, effect_code: card.effect, timing: card.timing,
        description: card.description, advantage: card.description, drawback: card.drawback,
        image_url: card.frontUrl, is_active: true,
      }]);
    }
  });

  it("validates the new baseline while preserving token, Buddie and green-thumb bonuses", async () => {
    expect((await start(null, 1)).xp).toBe(1);
    expect((await start("HERITAGE-001", 3)).xp).toBe(3);
    expect((await start("HERITAGE-002", 5)).xp).toBe(5);
    expect((await start("HERITAGE-020", 3)).xp).toBe(3);
    await expect(start("HERITAGE-001", 1)).rejects.toThrow("kq_heritage_state_mismatch");
    await expect(start("HERITAGE-002", 3)).rejects.toThrow("kq_heritage_state_mismatch");
    await db.query("INSERT INTO public.arena_chanvrier_profiles VALUES($1,'green-thumb')", [owner]);
    expect((await start("HERITAGE-001", 11, 2, "HH2026-001")).xp).toBe(11);
    expect((await start("HERITAGE-002", 13, 2, "HH2026-001")).xp).toBe(13);
    expect((await start(null, 9, 2, "HH2026-001")).xp).toBe(9);
    await db.query("DELETE FROM public.arena_chanvrier_profiles WHERE user_id=$1", [owner]);
  });

  it("aligns only the enlarged-hand description and preserves custom editorial fields", async () => {
    expect(otherDefinitionsAfter).toEqual(otherDefinitionsBefore);
    expect(otherEffectsAfter).toEqual(otherEffectsBefore);
    const opening = KQ_HERITAGE_EFFECT_TEMPLATES.find(template => template.effect === "opening-hand-reserve")!;
    expect((await db.query("SELECT name,description,advantage,drawback,image_url,is_active,auto_managed FROM public.kq_heritage_card_definitions WHERE code='HERITAGE-901'")).rows).toEqual([{
      name: "Nom personnalisé", description: opening.description, advantage: opening.description,
      drawback: "Usage personnalisé", image_url: "/custom/heritage.webp", is_active: false, auto_managed: false,
    }]);
    // Even the canonical producer may have editorial art; only the exact old
    // stock URL is eligible for the versioned, newly typeset front.
    const canonical = producerHeritages.cards.find(card => card.code === "HERITAGE-003")!;
    await db.query("UPDATE public.kq_heritage_card_definitions SET image_url='/custom/terracanna.webp' WHERE code='HERITAGE-003'");
    await db.exec(sql("20261020000300_kq_ten_card_hand.sql"));
    expect((await db.query("SELECT image_url FROM public.kq_heritage_card_definitions WHERE code='HERITAGE-003'")).rows).toEqual([{ image_url: "/custom/terracanna.webp" }]);
    await db.query("UPDATE public.kq_heritage_card_definitions SET image_url=$1 WHERE code='HERITAGE-003'", [canonical.frontUrl]);
  });

  it("reapplies the editorial alignment without rewriting cards, timestamps or histories", async () => {
    const definitions = (await db.query("SELECT * FROM public.kq_heritage_card_definitions ORDER BY code")).rows;
    const effects = (await db.query("SELECT * FROM public.kq_heritage_effect_catalog ORDER BY effect_code")).rows;
    const runs = (await db.query("SELECT * FROM public.kq_runs ORDER BY id")).rows;
    await db.exec(sql("20261020000300_kq_ten_card_hand.sql"));
    expect((await db.query("SELECT * FROM public.kq_heritage_card_definitions ORDER BY code")).rows).toEqual(definitions);
    expect((await db.query("SELECT * FROM public.kq_heritage_effect_catalog ORDER BY effect_code")).rows).toEqual(effects);
    expect((await db.query("SELECT * FROM public.kq_runs ORDER BY id")).rows).toEqual(runs);
    expect((await db.query("SELECT * FROM public.kq_heritage_draws ORDER BY card_code")).rows).toEqual(drawsBefore);
  });

  it("retains service-only execution of the atomic start RPC", async () => {
    const permissions = await db.query(`SELECT
      has_function_privilege('service_role','public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)','EXECUTE') AS service,
      has_function_privilege('anon','public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)','EXECUTE') AS anonymous,
      has_function_privilege('authenticated','public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)','EXECUTE') AS authenticated`);
    expect(permissions.rows).toEqual([{ service: true, anonymous: false, authenticated: false }]);
  });
});
