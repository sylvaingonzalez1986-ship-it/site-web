BEGIN;

-- An administrator can remove an Arena entry even after reviews or notebook
-- rewards exist. Deleting the association/grant record does not revoke the
-- booster entitlement that was already issued to the user.
ALTER TABLE public.kq_producer_reward_entries
  DROP CONSTRAINT IF EXISTS kq_producer_reward_entries_entry_id_fkey;
ALTER TABLE public.kq_producer_reward_entries
  ADD CONSTRAINT kq_producer_reward_entries_entry_id_fkey
  FOREIGN KEY (entry_id) REFERENCES public.contest_entries(id) ON DELETE CASCADE;

ALTER TABLE public.kq_notebook_flower_reward_grants
  DROP CONSTRAINT IF EXISTS kq_notebook_flower_reward_grants_entry_id_fkey;
ALTER TABLE public.kq_notebook_flower_reward_grants
  ADD CONSTRAINT kq_notebook_flower_reward_grants_entry_id_fkey
  FOREIGN KEY (entry_id) REFERENCES public.contest_entries(id) ON DELETE CASCADE;

ALTER TABLE public.kq_notebook_flower_reward_grants
  DROP CONSTRAINT IF EXISTS kq_notebook_flower_reward_grants_review_id_fkey;
ALTER TABLE public.kq_notebook_flower_reward_grants
  ADD CONSTRAINT kq_notebook_flower_reward_grants_review_id_fkey
  FOREIGN KEY (review_id) REFERENCES public.contest_reviews(id) ON DELETE CASCADE;

COMMIT;
