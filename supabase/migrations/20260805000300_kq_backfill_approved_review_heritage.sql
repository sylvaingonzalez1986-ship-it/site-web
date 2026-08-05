-- Reconcile reviews approved before producer Heritage rewards were activated.
-- The grant RPC is idempotent per user and producer campaign.
DO $$
DECLARE
  approved_review RECORD;
BEGIN
  FOR approved_review IN
    SELECT DISTINCT review.id, review.customer_id
    FROM public.contest_reviews review
    JOIN public.contest_entries entry
      ON entry.id = review.entry_id
      AND entry.producer_id IS NOT NULL
    JOIN public.kq_producer_reward_entries campaign_entry
      ON campaign_entry.entry_id = entry.id
    JOIN public.kq_producer_reward_campaigns campaign
      ON campaign.id = campaign_entry.campaign_id
      AND campaign.producer_id = entry.producer_id
      AND campaign.status = 'active'
    WHERE review.status = 'approved'
      AND review.customer_id IS NOT NULL
  LOOP
    PERFORM public.rpc_kq_grant_producer_notebook_rewards(
      approved_review.customer_id,
      approved_review.id
    );
  END LOOP;
END;
$$;
