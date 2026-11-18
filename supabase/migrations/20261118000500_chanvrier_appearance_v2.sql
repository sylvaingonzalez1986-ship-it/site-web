BEGIN;

-- Keep the existing CHECK and the service-only RPC, including its one-time bonus.
CREATE OR REPLACE FUNCTION public.arena_valid_appearance(value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  allowed CONSTANT JSONB := '{
    "body":["regular","compact","broad"],
    "hair":["crop","quiff","bob","long","curls","afro","braids","bun","ponytail","mohawk","buzz","bald","waves","pixie"],
    "hairColor":["black","chestnut","blond","ginger","silver","pink","indigo","mint"],
    "face":["oval","round","square","heart","long","angular","pear","cheeked"],
    "eyes":["almond","round","relaxed","bright"],
    "eyeColor":["brown","blue","green","grey","amber","hazel"],
    "eyebrows":["natural","thick","arched"],
    "nose":["small","round","wide"],
    "mouth":["smile","grin","calm"],
    "facialHair":["none","stubble","beard","moustache"],
    "top":["overalls","tee","hoodie","jacket","shirt","apron","mariniere","vareuse","fisher-knit","embroidered-vest","sailor-blouse","linen-shirt"],
    "bottom":["jeans","cargo","shorts","skirt","sailor-trousers","bragou-braz","pleated-skirt","work-trousers"],
    "shoes":["boots","sneakers","high-tops","work","clogs","deck-shoes"],
    "headwear":["none","watch-cap","sailor-cap","bachi","souwester","round-hat","bigouden-coif","lace-coif","headscarf"],
    "jacket":["none","pea-coat","raincoat","chupenn","kabig","wool-vest"],
    "accessory":["none","glasses","round-glasses","earrings","scarf","neckerchief","sash","brooch","satchel"],
    "bottomColor":["teal","blue","ochre","berry","sage","violet","cream","navy","slate","coral","butter","seafoam","heather","brick","ink","linen"],
    "shoeColor":["teal","blue","ochre","berry","sage","violet","cream","navy","slate","coral","butter","seafoam","heather","brick","ink","linen"],
    "jacketColor":["teal","blue","ochre","berry","sage","violet","cream","navy","slate","coral","butter","seafoam","heather","brick","ink","linen"],
    "headwearColor":["teal","blue","ochre","berry","sage","violet","cream","navy","slate","coral","butter","seafoam","heather","brick","ink","linen"],
    "accentColor":["teal","blue","ochre","berry","sage","violet","cream","navy","slate","coral","butter","seafoam","heather","brick","ink","linen"]
  }';
  entry RECORD;
  dye RECORD;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF value ? 'version' THEN
    IF value->'version' <> '2'::jsonb THEN RETURN false; END IF;
    IF NOT (value ?& ARRAY(SELECT jsonb_object_keys(allowed))) THEN RETURN false; END IF;
  END IF;
  FOR entry IN SELECT * FROM jsonb_each(value - 'version') LOOP
    IF entry.key = 'dyes' THEN
      IF jsonb_typeof(entry.value) <> 'object' THEN RETURN false; END IF;
      FOR dye IN SELECT * FROM jsonb_each(entry.value) LOOP
        IF dye.key NOT IN ('skin', 'hair', 'eyes', 'top', 'bottom', 'shoes', 'jacket', 'headwear', 'accent')
          OR jsonb_typeof(dye.value) <> 'string'
          OR (dye.value #>> '{}') !~ '^#[a-fA-F0-9]{6}$' THEN RETURN false; END IF;
      END LOOP;
    ELSIF NOT (allowed ? entry.key) OR NOT ((allowed->entry.key) @> jsonb_build_array(entry.value)) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END $$;

-- The original female silhouette defaulted to the bob unless a haircut was saved.
-- Preserve all explicit v1 choices, the existing owner and every gameplay column.
UPDATE public.arena_chanvrier_profiles
SET appearance = '{"version":2,"body":"regular","hair":"crop","hairColor":"chestnut","face":"oval","eyes":"almond","eyeColor":"brown","eyebrows":"natural","nose":"small","mouth":"smile","facialHair":"none","top":"overalls","bottom":"jeans","bottomColor":"blue","shoes":"boots","shoeColor":"ochre","accessory":"none","headwear":"none","jacket":"none","accentColor":"cream","jacketColor":"navy","headwearColor":"cream"}'::jsonb
    || jsonb_build_object('hair', CASE WHEN gender = 'female' THEN 'bob' ELSE 'crop' END)
    || appearance
WHERE NOT (appearance ? 'version');

-- A v1 browser still open during the release cannot erase slots it never saw.
-- Merge under the existing wallet/profile locks. A complete v2 submission may
-- remove dyes, so its object replaces the previous one in full.
DO $migration$
DECLARE
  definition TEXT := pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure);
  previous_expression TEXT := $sql$COALESCE(p_profile->'appearance',previous.appearance,'{}'::jsonb)$sql$;
BEGIN
  IF position(previous_expression in definition) = 0 THEN RAISE EXCEPTION 'chanvrier_appearance_rpc_drift'; END IF;
  EXECUTE replace(definition, previous_expression, $sql$
    CASE WHEN (p_profile->'appearance') ? 'version' THEN p_profile->'appearance'
         ELSE COALESCE(previous.appearance,'{}'::jsonb) || COALESCE(p_profile->'appearance','{}'::jsonb) END$sql$);
END $migration$;

COMMIT;
