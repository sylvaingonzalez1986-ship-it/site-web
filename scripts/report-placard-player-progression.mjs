// Read-only operator report; never issues a game command or changes database objects.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';

const sqlPath = 'scripts/sql/placard-player-progression.sql';
const usage = `Mesure de progression du jeu (lecture seule, résultats agrégés sans identifiants).

  node scripts/report-placard-player-progression.mjs --sql
    Affiche la requête à exécuter dans un éditeur SQL autorisé.
  node scripts/report-placard-player-progression.mjs --linked
    Interroge la base Supabase liée, après concordance avec la configuration du site.
    Utilise la CLI récente locale, ou SUPABASE_REPORT_CLI si défini.

Les cohortes partent de la première culture serveur. Les taux J1/J7 portent
sur des actions de culture observées, pas sur des sessions. Les ventes
automatiques comptent comme progression économique, jamais comme visite.
Chaque taux inclut numérateur, dénominateur mature et résultat null sans données.
Comparer les cohortes seulement après lecture des limites incluses dans le rapport.
`;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--help')) {
    console.log(usage);
    return;
  }
  assert(args.length === 1 && ['--sql', '--linked'].includes(args[0]), 'Options invalides. Utiliser --help.');
  if (args[0] === '--sql') {
    console.log(await readFile(sqlPath, 'utf8'));
    return;
  }
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const project = (await readFile('supabase/.temp/project-ref', 'utf8')).trim();
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  assert(url.protocol === 'https:' && url.hostname === `${project}.supabase.co` && !url.port && !url.username
    && !url.password && url.pathname === '/' && !url.search && !url.hash,
  'La base liée ne correspond pas à la configuration du site. Rapport interrompu.');
  const localCli = path.resolve('output/placard-rehearsal-tools/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
  const executable = process.env.SUPABASE_REPORT_CLI || (existsSync(localCli) ? localCli : 'supabase');
  const result = spawnSync(executable, ['db', 'query', '--linked', '--file', sqlPath, '--output', 'json'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  });
  // CLI diagnostics may contain connection details: do not relay stderr or errors.
  assert(!result.error && result.status === 0,
    'Rapport indisponible. Vérifier la connexion et une CLI Supabase compatible avec « db query ». Aucune écriture de jeu demandée.');
  // The SQL returns aggregate data only. Keep the CLI JSON envelope for provenance.
  JSON.parse(result.stdout);
  process.stdout.write(result.stdout);
}

main().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : 'Rapport indisponible : vérifier la configuration locale et la connexion Supabase.');
  process.exitCode = 1;
});
