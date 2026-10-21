-- Operator report only. No RPC, account creation, analytics event or schema change.
-- All calculations use immutable event dates, never kq_runs.updated_at.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

WITH report_clock AS (
  SELECT CURRENT_TIMESTAMP AS as_of
), cycles AS (
  -- Several zones in one campaign are one play cycle, not several returns.
  SELECT r.user_id, COALESCE(r.campaign_id, r.id) AS cycle_id,
    min(r.started_at) AS started_at,
    min(r.completed_at) FILTER (WHERE r.status::text = 'completed' AND r.completed_at <= c.as_of) AS harvested_at
  FROM public.kq_runs r CROSS JOIN report_clock c
  WHERE r.started_at <= c.as_of
  GROUP BY r.user_id, COALESCE(r.campaign_id, r.id)
), ranked_cycles AS (
  SELECT *, row_number() OVER (PARTITION BY user_id ORDER BY started_at, cycle_id) AS cycle_number
  FROM cycles
), players AS (
  SELECT user_id, min(started_at) AS first_started_at,
    min(started_at) FILTER (WHERE cycle_number = 2) AS second_started_at,
    min(harvested_at) AS first_harvested_at
  FROM ranked_cycles GROUP BY user_id
), sales AS (
  -- Online orders may happen offline. They are economic milestones only.
  SELECT owner_id AS user_id, created_at AS occurred_at FROM public.kq_market_sale_receipts
  UNION ALL
  SELECT user_id, occurred_at FROM public.kq_online_sales
), first_sales AS (
  SELECT s.user_id, min(s.occurred_at) AS first_sold_at
  FROM sales s JOIN players p USING (user_id) CROSS JOIN report_clock c
  WHERE s.occurred_at >= p.first_started_at AND s.occurred_at <= c.as_of
  GROUP BY s.user_id
), culture_activity AS (
  SELECT user_id, started_at AS occurred_at FROM cycles
  UNION
  SELECT user_id, completed_at FROM public.kq_runs WHERE status::text = 'completed' AND completed_at IS NOT NULL
  UNION
  SELECT user_id, burned_at FROM public.kq_card_burn_receipts
), observations AS (
  SELECT p.*, s.first_sold_at,
    date_trunc('week', p.first_started_at AT TIME ZONE 'Europe/Paris')::date AS cohort_week,
    p.first_started_at + interval '168 hours' <= c.as_of AS eligible_7d,
    p.first_started_at + interval '48 hours' <= c.as_of AS eligible_d1,
    p.first_started_at + interval '192 hours' <= c.as_of AS eligible_d7,
    EXISTS (SELECT 1 FROM culture_activity a WHERE a.user_id = p.user_id
      AND a.occurred_at >= p.first_started_at + interval '24 hours'
      AND a.occurred_at < p.first_started_at + interval '48 hours' AND a.occurred_at <= c.as_of) AS observed_d1,
    EXISTS (SELECT 1 FROM culture_activity a WHERE a.user_id = p.user_id
      AND a.occurred_at >= p.first_started_at + interval '168 hours'
      AND a.occurred_at < p.first_started_at + interval '192 hours' AND a.occurred_at <= c.as_of) AS observed_d7
  FROM players p LEFT JOIN first_sales s USING (user_id) CROSS JOIN report_clock c
), aggregates AS (
  SELECT CASE WHEN grouping(cohort_week) = 1 THEN 'all' ELSE cohort_week::text END AS cohort,
    count(*) AS players,
    count(*) FILTER (WHERE eligible_7d) AS eligible_7d,
    count(*) FILTER (WHERE eligible_d1) AS eligible_d1,
    count(*) FILTER (WHERE eligible_d7) AS eligible_d7,
    count(*) FILTER (WHERE eligible_7d AND first_harvested_at < first_started_at + interval '168 hours') AS harvested_7d,
    count(*) FILTER (WHERE eligible_7d AND second_started_at < first_started_at + interval '168 hours') AS second_cycle_7d,
    count(*) FILTER (WHERE eligible_7d AND first_sold_at < first_started_at + interval '168 hours') AS sold_7d,
    count(*) FILTER (WHERE eligible_d1 AND observed_d1) AS active_d1,
    count(*) FILTER (WHERE eligible_d7 AND observed_d7) AS active_d7,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_harvested_at - first_started_at) / 3600)
      FILTER (WHERE eligible_7d AND first_harvested_at < first_started_at + interval '168 hours'))::numeric, 2) AS median_harvest_hours,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM first_sold_at - first_started_at) / 3600)
      FILTER (WHERE eligible_7d AND first_sold_at < first_started_at + interval '168 hours'))::numeric, 2) AS median_sale_hours
  FROM observations GROUP BY GROUPING SETS ((), (cohort_week))
), cohort_reports AS (
  SELECT a.cohort, jsonb_build_object(
    'cohortWeek', a.cohort, 'players', a.players,
    'pendingSevenDayWindow', a.players - a.eligible_7d,
    'pendingD1Window', a.players - a.eligible_d1,
    'pendingD7Window', a.players - a.eligible_d7,
    'metrics', (SELECT jsonb_object_agg(m.code, jsonb_build_object(
      'label', m.label, 'numerator', m.numerator, 'denominator', m.denominator,
      'percent', round(100.0 * m.numerator / nullif(m.denominator, 0), 1)))
      FROM (VALUES
        ('harvestWithin7Days', 'Au moins une récolte dans les 168 premières heures', a.harvested_7d, a.eligible_7d),
        ('secondCycleWithin7Days', 'Deuxième cycle lancé dans les 168 premières heures', a.second_cycle_7d, a.eligible_7d),
        ('saleWithin7Days', 'Première vente dans les 168 premières heures', a.sold_7d, a.eligible_7d),
        ('cultureActivityD1', 'Activité de culture observée entre 24 et 48 h', a.active_d1, a.eligible_d1),
        ('cultureActivityD7', 'Activité de culture observée entre 168 et 192 h', a.active_d7, a.eligible_d7)
      ) AS m(code, label, numerator, denominator)),
    'medianHoursAmongSevenDayConverters', jsonb_build_object(
      'firstHarvest', a.median_harvest_hours, 'firstSale', a.median_sale_hours)
  ) AS report FROM aggregates a
)
SELECT jsonb_build_object(
  'version', 1, 'generatedAt', (SELECT as_of FROM report_clock),
  'cohortTimezone', 'Europe/Paris',
  'population', 'Comptes ayant lancé une culture serveur. Une campagne multizone compte pour un cycle.',
  'observation', 'Les fenêtres commencent à la première culture, en heures écoulées. Seules les fenêtres entièrement terminées entrent au dénominateur.',
  'activitySources', jsonb_build_array('kq_runs.started_at', 'kq_runs.completed_at', 'kq_card_burn_receipts.burned_at'),
  'saleSources', jsonb_build_array('kq_market_sale_receipts.created_at', 'kq_online_sales.occurred_at'),
  'limits', jsonb_build_array(
    'J1/J7 mesurent des actions de culture enregistrées, pas des connexions ni toutes les actions du jeu. Une absence observée ne prouve pas un abandon.',
    'Les ventes en ligne peuvent survenir hors connexion ; elles ne comptent jamais comme une visite.',
    'Les comptes de test et administrateurs ne sont pas identifiés dans ces tables et restent inclus. Les comptes supprimés ne sont plus représentés.',
    'Le tutoriel local, les visiteurs sans première culture et les sessions sans action ne sont pas mesurables avec ces sources.',
    'Une culture morte ne compte pas comme une récolte. Un cycle multizone est récolté dès la première zone récoltée.',
    'Les médianes concernent seulement les comptes convertis dans les sept jours parmi les fenêtres matures ; elles ne prédisent pas le temps des autres comptes.',
    'Un taux null signifie aucun compte éligible. Les petits effectifs et les changements de règles limitent les comparaisons.'),
  'overall', (SELECT report FROM cohort_reports WHERE cohort = 'all'),
  'weeklyCohorts', (SELECT COALESCE(jsonb_agg(report ORDER BY cohort), '[]'::jsonb) FROM cohort_reports WHERE cohort <> 'all')
) AS report;
ROLLBACK;
