-- PREPARE, NON EXECUTE dans cet audit. A lancer seulement apres identification
-- du projet cible et avec un compte de diagnostic autorise. Aucun contenu joueur.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
SELECT version(), current_setting('max_connections') AS max_connections,
       pg_database_size(current_database()) AS database_bytes;
SELECT backend_type, state, wait_event_type, wait_event, count(*) AS connections
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY backend_type, state, wait_event_type, wait_event;
SELECT relname, n_live_tup, n_dead_tup, seq_scan, idx_scan, n_tup_ins, n_tup_upd,
       n_tup_del, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables WHERE schemaname='public' AND relname LIKE 'kq\_%' ESCAPE '\'
ORDER BY n_live_tup DESC LIMIT 30;
SELECT relname, pg_total_relation_size(relid) AS bytes
FROM pg_stat_user_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;
SELECT count(*) AS online_accounts,
       count(*) FILTER (WHERE settled_until < now()-interval '1 hour') AS not_settled_one_hour,
       max(now()-settled_until) AS max_age_all_accounts
FROM public.kq_online_accounts;
-- Le dernier age inclut des commerces inactifs : ne pas le confondre avec
-- l'anciennete des seuls comptes eligibles au worker. Lire son predicat deploye.
ROLLBACK;

-- Optionnel, si pg_stat_statements existe (adapter son schema via pg_extension).
-- Pas de query text : les statistiques restent sans valeurs/identites utilisateur.
-- SELECT queryid, calls, total_exec_time, mean_exec_time, rows,
--        shared_blks_hit, shared_blks_read, temp_blks_written
-- FROM extensions.pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
-- Prendre deux echantillons a intervalle connu, sans RESET de statistiques.
-- EXPLAIN seul peut etre prepare pour une requete SELECT representative.
-- Ne pas employer EXPLAIN ANALYZE sur un RPC de lecture qui regle des revenus.
