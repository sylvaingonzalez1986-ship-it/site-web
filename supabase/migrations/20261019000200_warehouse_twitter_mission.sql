BEGIN;

-- Uses the existing private proof upload, admin review and atomic pack issuer.
-- No social account connection or automatic publication is involved.
INSERT INTO public.social_missions (
  slug, title, description, icon,
  reward_type, reward_amount, reward_card_id,
  max_completions_per_user, requires_proof, proof_instructions,
  is_active, sort_order
)
VALUES (
  'entrepot-sur-x',
  'Ton entrepôt sur X',
  'Partage une capture de ton entrepôt du jeu sur X (Twitter) : 1 pack Buddies après validation, une seule fois par compte.',
  'camera',
  'packs', 1, NULL,
  1, true,
  'Publie sur ton compte X (Twitter) une capture de ton entrepôt du jeu. Joins ici une capture du post publié où l’on voit ton pseudo, le texte et l’image de l’entrepôt. Une capture de l’entrepôt seul ne suffit pas. Tu peux aussi ajouter le lien HTTPS du post. Précise ton pseudo de joueur dans le message pour l’équipe. L’équipe vérifie la preuve avant d’attribuer 1 pack Buddies ; cette mission est récompensée une seule fois par compte.',
  true, 35
)
-- Preserve an existing mission and any choices already made by its admin.
ON CONFLICT (slug) DO NOTHING;

COMMIT;
