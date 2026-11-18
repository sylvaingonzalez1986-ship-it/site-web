BEGIN;

SELECT pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'));

-- Retire these Heritage partnerships without deleting shop producers, earned
-- cards, reward receipts or the immutable identity of a culture in progress.
UPDATE public.kq_heritage_card_definitions
SET is_active = FALSE, updated_at = now()
WHERE producer_id IN (
  'producer-1773871212890-5816', -- Cannapache
  'producer-1773871368477-5738', -- Cap Estuaire
  'producer-1771159879557-3228', -- Hot Alpine Weed
  'producer-1773872025906-6885'  -- Skud Farm
);

UPDATE public.kq_producer_reward_campaigns
SET status = 'archived', updated_at = now()
WHERE producer_id IN (
  'producer-1773871212890-5816',
  'producer-1773871368477-5738',
  'producer-1771159879557-3228', -- Hot Alpine Weed
  'producer-1773872025906-6885'
) AND status <> 'archived';

-- Neither the editorial RPC nor campaign activation may silently bring a
-- retired partnership back into the playable or claimable catalogue.
ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT kq_retired_producer_heritages_inactive,
  ADD CONSTRAINT kq_retired_producer_heritages_inactive CHECK (
    NOT is_active OR producer_id NOT IN (
      'producer-1773871212890-5816',
      'producer-1773871368477-5738',
      'producer-1771159879557-3228', -- Hot Alpine Weed
  'producer-1773872025906-6885'
    )
  );
ALTER TABLE public.kq_producer_reward_campaigns
  DROP CONSTRAINT kq_retired_producer_campaigns_inactive,
  ADD CONSTRAINT kq_retired_producer_campaigns_inactive CHECK (
    status <> 'active' OR producer_id NOT IN (
      'producer-1773871212890-5816',
      'producer-1773871368477-5738',
      'producer-1771159879557-3228', -- Hot Alpine Weed
  'producer-1773872025906-6885'
    )
  );

COMMIT;
