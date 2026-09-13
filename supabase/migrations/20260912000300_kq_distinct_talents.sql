BEGIN;
ALTER TABLE public.kq_support_card_rules DROP CONSTRAINT IF EXISTS kq_support_card_rules_effect_check;
ALTER TABLE public.kq_support_card_rules ADD CONSTRAINT kq_support_card_rules_effect_check CHECK (effect IN ('pbi-success', 'cancel-danger', 'reveal-pest', 'reroll-neutral', 'reroll-two-low', 'pbi-strong-success', 'pbi-neutral-strong', 'pbi-success-xp', 'root-aeration', 'hygrometer-balance', 'neutral-to-success', 'patient-curing', 'four-keep-three', 'water-test', 'perlite-drainage', 'biochar-buffer', 'organic-feed', 'pbi-mite-shield', 'pbi-thrips-relief', 'water-rescue', 'pest-monitor', 'double-danger-shield', 'compliance-clearance', 'illegal-power', 'leaf-thinning', 'moisture-calibration', 'bill-relief', 'harvest-four-quality', 'harvest-cool', 'theft-guard', 'danger-to-neutral', 'clean-cut', 'starter-stability', 'hydroponic-control', 'aeroponic-precision', 'living-soil-buffer', 'compost-buffer', 'safe-neutral-reroll', 'three-to-success'));

UPDATE public.lottery_card_definitions SET description = 'Transforme un dé faible en réussite contre pucerons ou thrips.', updated_at = now() WHERE code = 'BOTTE-002';
UPDATE public.kq_support_card_rules SET effect = 'pbi-success', timing = 'after-roll', xp_cost = 2, advantage = 'Transforme un dé faible en réussite et neutralise le ravageur ciblé.', drawback = 'Brûle une PBI de la réserve et utilise l’unique réaction.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-002');

UPDATE public.lottery_card_definitions SET description = 'Annule un Danger sur une Situation Climat ou Séchage.', updated_at = now() WHERE code = 'BOTTE-003';
UPDATE public.kq_support_card_rules SET effect = 'cancel-danger', timing = 'before-roll', xp_cost = 1, advantage = 'Protège le lancer contre un Danger.', drawback = 'La protection est perdue si aucun 1 ne sort.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-003');

UPDATE public.lottery_card_definitions SET description = 'Identifie un ravageur, ouvre ta réserve PBI et protège contre un Danger.', updated_at = now() WHERE code = 'BOTTE-004';
UPDATE public.kq_support_card_rules SET effect = 'reveal-pest', timing = 'before-roll', xp_cost = 1, advantage = 'Révèle le ravageur, ouvre les PBI compatibles et protège contre un Danger.', drawback = 'Consomme l’unique préparation du tour sans modifier directement les dés.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-004');

UPDATE public.lottery_card_definitions SET description = 'Relance un dé neutre sur une Situation Eau ou Racines.', updated_at = now() WHERE code = 'BOTTE-005';
UPDATE public.kq_support_card_rules SET effect = 'reroll-neutral', timing = 'before-roll', xp_cost = 1, advantage = 'Donne une nouvelle chance à un dé neutre.', drawback = 'La relance peut produire un Danger.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-005');

UPDATE public.lottery_card_definitions SET description = 'Relance les deux dés les plus faibles.', updated_at = now() WHERE code = 'BOTTE-006';
UPDATE public.kq_support_card_rules SET effect = 'reroll-two-low', timing = 'after-roll', xp_cost = 2, advantage = 'Relance les deux dés les plus faibles.', drawback = 'Une nouvelle face peut être moins bonne que la précédente.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-006');

UPDATE public.lottery_card_definitions SET description = 'Transforme un dé faible en Étincelle contre les pucerons : une réussite et 1 XP au verdict.', updated_at = now() WHERE code = 'BOTTE-010';
UPDATE public.kq_support_card_rules SET effect = 'pbi-strong-success', timing = 'after-roll', xp_cost = 3, advantage = 'Transforme un dé faible en réussite et neutralise le ravageur ciblé.', drawback = 'Brûle une PBI de la réserve et utilise l’unique réaction.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-010');

UPDATE public.lottery_card_definitions SET description = 'Contre les acariens ou thrips révélés, transforme un dé neutre en 5. Ne corrige pas les Dangers.', updated_at = now() WHERE code = 'BOTTE-011';
UPDATE public.kq_support_card_rules SET effect = 'pbi-neutral-strong', timing = 'after-roll', xp_cost = 2, advantage = 'Contre les acariens ou thrips révélés, transforme un dé neutre en 5. Ne corrige pas les Dangers.', drawback = 'Occupe ta réaction ; conserve-la si une autre correction serait plus utile.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-011');

UPDATE public.lottery_card_definitions SET description = 'Transforme un dé faible en réussite contre les pucerons et rapporte +1 XP en cas de succès.', updated_at = now() WHERE code = 'BOTTE-012';
UPDATE public.kq_support_card_rules SET effect = 'pbi-success-xp', timing = 'after-roll', xp_cost = 2, advantage = 'Transforme un dé faible en réussite et peut rapporter 1 XP supplémentaire.', drawback = 'Brûle une PBI de la réserve et utilise l’unique réaction.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-012');

UPDATE public.lottery_card_definitions SET description = 'Transforme un Danger en résultat neutre sur Racines ou Eau, mais gagne 1 Pression car le pot sèche vite.', updated_at = now() WHERE code = 'BOTTE-013';
UPDATE public.kq_support_card_rules SET effect = 'root-aeration', timing = 'before-roll', xp_cost = 1, advantage = 'Transforme un Danger en résultat neutre sur Racines ou Eau.', drawback = 'Le pot sèche vite : jouer la carte ajoute immédiatement 1 Pression.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-013');

UPDATE public.lottery_card_definitions SET description = 'Sur Eau, Climat ou Séchage, réduit la Pression de 1 et transforme un 3 en 4.', updated_at = now() WHERE code = 'BOTTE-014';
UPDATE public.kq_support_card_rules SET effect = 'hygrometer-balance', timing = 'before-roll', xp_cost = 2, advantage = 'Sur Eau, Climat ou Séchage, réduit la Pression de 1 et transforme un 3 en 4.', drawback = 'Occupe ta préparation ; un effet conditionnel peut ne pas se déclencher.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-014');

UPDATE public.lottery_card_definitions SET description = 'Transforme un dé neutre en réussite pendant la Floraison.', updated_at = now() WHERE code = 'BOTTE-015';
UPDATE public.kq_support_card_rules SET effect = 'neutral-to-success', timing = 'before-roll', xp_cost = 2, advantage = 'Transforme automatiquement un dé neutre en réussite.', drawback = 'La carte est perdue si aucun dé neutre ne sort.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-015');

UPDATE public.lottery_card_definitions SET description = 'Au Séchage, réduit la Pression de 1 ; gagne 1 Qualité si l’étape réussit. Ne modifie pas les dés.', updated_at = now() WHERE code = 'BOTTE-016';
UPDATE public.kq_support_card_rules SET effect = 'patient-curing', timing = 'before-roll', xp_cost = 2, advantage = 'Au Séchage, réduit la Pression de 1 ; gagne 1 Qualité si l’étape réussit. Ne modifie pas les dés.', drawback = 'Occupe ta préparation ; un effet conditionnel peut ne pas se déclencher.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-016');

UPDATE public.lottery_card_definitions SET description = 'Lance quatre dés et conserve les trois meilleurs.', updated_at = now() WHERE code = 'BOTTE-017';
UPDATE public.kq_support_card_rules SET effect = 'four-keep-three', timing = 'before-roll', xp_cost = 2, advantage = 'Lance quatre dés et conserve les trois meilleurs.', drawback = 'Occupe l’unique préparation disponible.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-017');

UPDATE public.lottery_card_definitions SET description = 'Relance le dé le plus faible sur une Situation Eau ou Racines et gagne 1 XP si le résultat s’améliore.', updated_at = now() WHERE code = 'BOTTE-018';
UPDATE public.kq_support_card_rules SET effect = 'water-test', timing = 'after-roll', xp_cost = 2, advantage = 'Relance le dé le plus faible et rembourse 1 XP si la mesure améliore le résultat.', drawback = 'La relance reste définitive et peut être moins bonne.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-018');

UPDATE public.lottery_card_definitions SET description = 'Sur Racines ou Eau, corrige le plus mauvais dé : un 1 devient 2, ou un 2 devient 4.', updated_at = now() WHERE code = 'BOTTE-019';
UPDATE public.kq_support_card_rules SET effect = 'perlite-drainage', timing = 'after-roll', xp_cost = 1, advantage = 'Corrige le plus mauvais résultat : un Danger devient neutre ou un 2 devient réussite.', drawback = 'Ne transforme jamais un 1 directement en réussite et consomme la réaction.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-019');

UPDATE public.lottery_card_definitions SET description = 'Sur Racines ou Ravageur, transforme le premier Danger en neutre et réduit la Pression de 1.', updated_at = now() WHERE code = 'BOTTE-020';
UPDATE public.kq_support_card_rules SET effect = 'biochar-buffer', timing = 'before-roll', xp_cost = 2, advantage = 'Amortit un Danger et fait baisser la Pression si le tampon se déclenche.', drawback = 'Coûte 2 XP avant de savoir si un Danger sortira.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-020');

UPDATE public.lottery_card_definitions SET description = 'Sur Racines ou Floraison, avec exactement deux réussites, transforme un dé neutre en Étincelle.', updated_at = now() WHERE code = 'BOTTE-021';
UPDATE public.kq_support_card_rules SET effect = 'organic-feed', timing = 'after-roll', xp_cost = 2, advantage = 'Convertit un résultat déjà solide en Étincelle et augmente le plafond de qualité.', drawback = 'Exige exactement deux réussites et un dé neutre après le lancer.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-021');

UPDATE public.lottery_card_definitions SET description = 'Contre les acariens révélés, transforme un Danger en 4 et protège contre un autre Danger.', updated_at = now() WHERE code = 'BOTTE-022';
UPDATE public.kq_support_card_rules SET effect = 'pbi-mite-shield', timing = 'after-roll', xp_cost = 3, advantage = 'Contre les acariens révélés, transforme un Danger en 4 et protège contre un autre Danger.', drawback = 'Occupe ta réaction ; conserve-la si une autre correction serait plus utile.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-022');

UPDATE public.lottery_card_definitions SET description = 'Contre les thrips, transforme un dé faible en réussite et réduit la Pression de 1.', updated_at = now() WHERE code = 'BOTTE-023';
UPDATE public.kq_support_card_rules SET effect = 'pbi-thrips-relief', timing = 'after-roll', xp_cost = 2, advantage = 'Corrige un dé faible contre les thrips et réduit immédiatement la Pression de 1.', drawback = 'Ne cible que les thrips et brûle l’unique réaction de l’étape.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-023');

UPDATE public.lottery_card_definitions SET description = 'Après les dés, sur Eau, transforme un Danger en 4 mais ajoute 1 Pression.', updated_at = now() WHERE code = 'BOTTE-024';
UPDATE public.kq_support_card_rules SET effect = 'water-rescue', timing = 'after-roll', xp_cost = 1, advantage = 'Après les dés, sur Eau, transforme un Danger en 4 mais ajoute 1 Pression.', drawback = 'Occupe ta réaction ; conserve-la si une autre correction serait plus utile.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-024');

UPDATE public.lottery_card_definitions SET description = 'Identifie le ravageur et récupère 1 XP pour préparer une réponse PBI.', updated_at = now() WHERE code = 'BOTTE-025';
UPDATE public.kq_support_card_rules SET effect = 'pest-monitor', timing = 'before-roll', xp_cost = 1, advantage = 'Identifie le ravageur à faible coût et ouvre la réserve PBI.', drawback = 'Ne modifie pas directement les dés.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-025');

UPDATE public.lottery_card_definitions SET description = 'Annule jusqu’à deux Dangers sur une Situation Climat ou Séchage.', updated_at = now() WHERE code = 'BOTTE-026';
UPDATE public.kq_support_card_rules SET effect = 'double-danger-shield', timing = 'before-roll', xp_cost = 2, advantage = 'Peut annuler deux Dangers sur le même lancer.', drawback = 'Coûte 2 XP même si aucun Danger ne sort.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-026');

UPDATE public.lottery_card_definitions SET description = 'Face à un contrôle DDTM, présente le dossier complet : les trois dés deviennent des réussites.', updated_at = now() WHERE code = 'BOTTE-027';
UPDATE public.kq_support_card_rules SET effect = 'compliance-clearance', timing = 'before-roll', xp_cost = 3, advantage = 'Garantit immédiatement trois réussites pendant le contrôle DDTM.', drawback = 'Coûte 3 XP et ne sert que sur cette Situation administrative.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-027');

UPDATE public.lottery_card_definitions SET description = 'Après un mauvais jet sur la surcharge électrique, transforme les deux dés les plus faibles en réussites mais gagne 2 Pression.', updated_at = now() WHERE code = 'BOTTE-028';
UPDATE public.kq_support_card_rules SET effect = 'illegal-power', timing = 'after-roll', xp_cost = 1, advantage = 'Transforme les deux dés les plus faibles en réussites et évite la coupure.', drawback = 'Ajoute immédiatement 2 Pression et brûle la carte.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-028');

UPDATE public.lottery_card_definitions SET description = 'Sur Floraison ou Climat, relance un dé neutre en gardant le meilleur résultat ; ajoute 1 Pression.', updated_at = now() WHERE code = 'BOTTE-029';
UPDATE public.kq_support_card_rules SET effect = 'leaf-thinning', timing = 'before-roll', xp_cost = 1, advantage = 'Sur Floraison ou Climat, relance un dé neutre en gardant le meilleur résultat ; ajoute 1 Pression.', drawback = 'Occupe ta préparation ; un effet conditionnel peut ne pas se déclencher.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-029');

UPDATE public.lottery_card_definitions SET description = 'Pendant le Séchage, transforme un 2 en 4 ou un 3 en 5.', updated_at = now() WHERE code = 'BOTTE-030';
UPDATE public.kq_support_card_rules SET effect = 'moisture-calibration', timing = 'after-roll', xp_cost = 2, advantage = 'Convertit précisément un dé neutre selon sa valeur.', drawback = 'Réservée au Séchage et exige un 2 ou un 3.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-030');

UPDATE public.lottery_card_definitions SET description = 'Sur une Situation Énergie, réduit de 1 le nombre de réussites exigées pour stabiliser l’installation.', updated_at = now() WHERE code = 'BOTTE-031';
UPDATE public.kq_support_card_rules SET effect = 'bill-relief', timing = 'before-roll', xp_cost = 1, advantage = 'Réduit de 1 le seuil de réussite face à la surcharge électrique.', drawback = 'Ne change aucune face de dé et reste réservé aux Situations Énergie.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-031');

UPDATE public.lottery_card_definitions SET description = 'En Récolte, lance quatre dés, garde les trois meilleurs et gagne 1 Qualité en cas de réussite.', updated_at = now() WHERE code = 'BOTTE-032';
UPDATE public.kq_support_card_rules SET effect = 'harvest-four-quality', timing = 'before-roll', xp_cost = 2, advantage = 'Sécurise le lancer et ajoute 1 Qualité sur une bonne récolte.', drawback = 'Réservée à la Récolte et coûte 2 XP.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-032');

UPDATE public.lottery_card_definitions SET description = 'Annule un Danger en Récolte et réduit la Pression de 1 si la protection se déclenche.', updated_at = now() WHERE code = 'BOTTE-033';
UPDATE public.kq_support_card_rules SET effect = 'harvest-cool', timing = 'before-roll', xp_cost = 1, advantage = 'Protège la récolte et fait retomber la Pression si nécessaire.', drawback = 'La baisse de Pression exige qu’un Danger soit effectivement annulé.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-033');

UPDATE public.lottery_card_definitions SET description = 'Protège toute la récolte contre le Renard à deux pattes, quel que soit le résultat des dés.', updated_at = now() WHERE code = 'BOTTE-034';
UPDATE public.kq_support_card_rules SET effect = 'theft-guard', timing = 'before-roll', xp_cost = 2, advantage = 'Empêche toute perte de quantité lors du vol de récolte.', drawback = 'Ne change pas le verdict du jury et coûte 2 XP.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-034');

UPDATE public.lottery_card_definitions SET description = 'En Récolte, transforme un Danger en résultat neutre pour isoler la partie fragile du lot.', updated_at = now() WHERE code = 'BOTTE-035';
UPDATE public.kq_support_card_rules SET effect = 'danger-to-neutral', timing = 'after-roll', xp_cost = 2, advantage = 'Isole un Danger sans garantir une réussite.', drawback = 'Occupe l’unique réaction et exige un Danger.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-035');

UPDATE public.lottery_card_definitions SET description = 'Annule un Danger en Récolte et rapporte 1 XP si l’étape est réussie.', updated_at = now() WHERE code = 'BOTTE-036';
UPDATE public.kq_support_card_rules SET effect = 'clean-cut', timing = 'before-roll', xp_cost = 1, advantage = 'Protège le lancer et rembourse 1 XP si la récolte réussit.', drawback = 'Réservée à la Récolte.', rules_version = rules_version + 1, updated_at = now() WHERE card_definition_id IN (SELECT id FROM public.lottery_card_definitions WHERE code = 'BOTTE-036');

UPDATE public.lottery_card_definitions SET description = 'Avantage Légendaire IV : +4 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-001';

UPDATE public.lottery_card_definitions SET description = 'Avantage Épique III : +3 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-002';

UPDATE public.lottery_card_definitions SET description = 'Avantage Épique III : +3 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-003';

UPDATE public.lottery_card_definitions SET description = 'Avantage Épique III : +3 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-004';

UPDATE public.lottery_card_definitions SET description = 'Avantage Or II : +2 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-005';

UPDATE public.lottery_card_definitions SET description = 'Avantage Or II : +2 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-006';

UPDATE public.lottery_card_definitions SET description = 'Avantage Or II : +2 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-007';

UPDATE public.lottery_card_definitions SET description = 'Avantage Or II : +2 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-008';

UPDATE public.lottery_card_definitions SET description = 'Avantage Or II : +2 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-009';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-010';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-011';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-012';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-013';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-014';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-015';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-016';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-017';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-018';

UPDATE public.lottery_card_definitions SET description = 'Avantage Argent I : +1 XP au départ de la culture.', updated_at = now() WHERE code = 'HH2026-019';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-020';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-021';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-022';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-023';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-024';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-025';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-026';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-027';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-028';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-029';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-030';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-031';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-032';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-033';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-034';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-035';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-036';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-037';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-038';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-039';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-040';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-041';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-042';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-043';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-044';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-045';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-046';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-047';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-048';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-049';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-050';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-051';

UPDATE public.lottery_card_definitions SET description = 'Buddie commun : aucun avantage de jeu.', updated_at = now() WHERE code = 'HH2026-052';

UPDATE public.kq_equipment_catalog SET price_cents = 55000 WHERE code = 'SIFT-TRAY';

UPDATE public.kq_equipment_catalog SET price_cents = 85000 WHERE code = 'PRESS-0600';

UPDATE public.kq_equipment_catalog SET price_cents = 125000 WHERE code = 'WASHER-25L';

COMMIT;
