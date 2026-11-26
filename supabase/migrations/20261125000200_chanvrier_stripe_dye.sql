BEGIN;

-- An optional colour in the existing appearance JSON. Keep the validator's
-- catalog, hex checks and privileges, and leave existing rows untouched.
DO $migration$
DECLARE
  validator text := pg_get_functiondef('public.arena_valid_appearance(jsonb)'::regprocedure);
  previous_zones constant text := $sql$'jacket', 'headwear', 'accent')$sql$;
  save_profile text := pg_get_functiondef('public.rpc_arena_save_chanvrier(uuid,jsonb)'::regprocedure);
  complete_look constant text := $sql$WHEN (p_profile->'appearance') ? 'version' THEN p_profile->'appearance'$sql$;
BEGIN
  IF strpos(validator, previous_zones) = 0 OR strpos(save_profile, complete_look) = 0 THEN
    RAISE EXCEPTION 'chanvrier_stripe_contract_drift';
  END IF;
  EXECUTE replace(validator, previous_zones, $sql$'jacket', 'headwear', 'accent', 'stripe')$sql$);

  -- An already open v2 editor can replace the other dyes. Carry the stripe
  -- from the locked row unless the sender supports explicitly clearing it.
  EXECUTE replace(save_profile, complete_look, $sql$
    WHEN (p_profile->'appearance') ? 'version' THEN
      CASE WHEN p_profile->'supportsStripe' = 'true'::jsonb
                  OR (p_profile #> '{appearance,dyes,stripe}') IS NOT NULL
                  OR (previous.appearance #> '{dyes,stripe}') IS NULL
        THEN p_profile->'appearance'
        ELSE jsonb_set(p_profile->'appearance', '{dyes}',
          COALESCE(p_profile #> '{appearance,dyes}', '{}'::jsonb)
          || jsonb_build_object('stripe', previous.appearance #> '{dyes,stripe}'))
      END$sql$);
END $migration$;

COMMIT;
