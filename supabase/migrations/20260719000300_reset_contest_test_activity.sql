-- One-time production cleanup: all activity recorded before this migration
-- belongs to the Arena test phase. Accounts, tester profiles, seasons, badge
-- definitions, reward definitions and contest entries are intentionally kept.
DO $reset$
BEGIN
  DELETE FROM public.contest_reward_unlocks;
  DELETE FROM public.contest_profile_badges;
  DELETE FROM public.contest_tester_points;
  DELETE FROM public.contest_reviews;
END
$reset$;

-- contest_review_scores, contest_review_aroma_tags,
-- contest_review_terpene_guesses and contest_review_votes are removed through
-- their ON DELETE CASCADE foreign keys.
