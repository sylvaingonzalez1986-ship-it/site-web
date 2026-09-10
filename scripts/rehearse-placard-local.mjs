import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

if (process.env.PLACARD_REHEARSAL_CONFIRM !== "LOCAL_DISPOSABLE_ONLY") {
  throw new Error("PLACARD_REHEARSAL_CONFIRM=LOCAL_DISPOSABLE_ONLY est requis : crée des comptes et fixtures locaux.");
}
const root = process.cwd();
const baseUrl = "http://127.0.0.1:3107";
// Capture CLI output in memory; never print or archive the local signing keys.
const workspaceCli = resolve(root, "output/placard-rehearsal-tools/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const cli = existsSync(workspaceCli) ? workspaceCli : "supabase";
const status = JSON.parse(execFileSync(cli, ["status", "-o", "json"], {
  encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
}));
if (status.API_URL !== "http://127.0.0.1:54321" || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
  throw new Error("Instance Supabase locale attendue indisponible.");
}
const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
const serviceKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
const service = createClient(status.API_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? "erreur"} ${result.error.message}`);
  return result.data;
}
// Load only the pure game engine for fixture construction, without a second rule implementation.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return { url: pathToFileURL(resolve(root, "src", `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(pathToFileURL(resolve(root, "src/lib")).href) && url.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8")), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const game = await import("../src/lib/kanab-quest-game.ts");
const { createKqFlower } = await import("../src/lib/kanab-quest-battle.ts");
const { getKqChallengeDayKey, evaluateKqChallenges } = await import("../src/lib/kanab-quest-challenges.ts");
hooks.deregister();

const secret = randomUUID() + randomUUID();
const childEnv = {
  ...process.env,
  NODE_ENV: "development", KQ_LOCAL_PLAYER_PREVIEW: "true", KQ_PLAYER_API_LIVE: "false",
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  ADMIN_SESSION_SECRET: secret, SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const server = spawn(process.execPath, ["scripts/lib/placard-rehearsal-server.mjs"], {
  cwd: root, env: childEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
// Do not print authenticated URLs, request bodies or keys from server logs.
let serverExited = false;
server.on("exit", () => { serverExited = true; });
server.stdout.on("data", () => {});
server.stderr.on("data", () => {});

async function request(account, path, body, method = body ? "POST" : "GET") {
  const response = await fetch(`${baseUrl}${path}`, {
    method, redirect: "manual", signal: AbortSignal.timeout(120_000),
    headers: { cookie: account.cookie, origin: baseUrl, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path.replace(/[0-9a-f-]{36}/gi, "[id]")}: HTTP ${response.status} ${payload.error ?? ""}`);
  return payload;
}
async function smoke(account, action, input) {
  const output = await new Promise((accept, reject) => {
    const child = spawn(process.execPath, ["scripts/smoke-test-placard-transactions.mjs"], {
      cwd: root, windowsHide: true,
      env: { ...childEnv, PLACARD_SMOKE_BASE_URL: baseUrl, PLACARD_SMOKE_COOKIE: account.cookie,
        PLACARD_SMOKE_ACTION: action, PLACARD_SMOKE_CONFIRM_DATABASE: "LOCAL_SUPABASE_ONLY",
        PLACARD_SMOKE_CONFIRM_BURNS: "LOCAL_BURNS_ONLY", PLACARD_SMOKE_CONFIRM_MARKET: "LOCAL_MARKET_ONLY",
        PLACARD_SMOKE_CONFIRM_EQUIPMENT: "LOCAL_EQUIPMENT_ONLY", ...input },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? accept(stdout) : reject(new Error(`Smoke ${action} échoué : ${stderr}\n${stdout}`)));
  });
  const report = JSON.parse(output);
  console.log(`${action}: ${report.succeeded ? "VALIDÉ" : "ÉCHEC"} — ${report.artifactPath}`);
}

try {
  console.log("Préparation de deux comptes fictifs dans Supabase local.");
  const accounts = [];
  const definitions = checked(await service.from("lottery_card_definitions").select("id,code").in("code", ["HH2026-001", "BOTTE-001", "BOTTE-004"]), "Catalogue");
  if (definitions.length !== 3) throw new Error("Le catalogue local manque des trois cartes de recette.");
  for (let index = 0; index < 2; index++) {
    const email = `placard-recette-${randomUUID()}@example.test`;
    const password = randomUUID() + "aA1!";
    const auth = checked(await service.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { first_name: "Recette", last_name: String(index + 1), date_of_birth: "1990-01-01" } }), "Création compte");
    const id = auth.user.id;
    checked(await service.from("kq_rank_profiles").insert({ user_id: id }), "Profil de jeu");
    const entitlement = checked(await service.from("kq_support_booster_entitlements").insert({
      user_id: id, source: "arena_streak", reward_key: `recette:${randomUUID()}`,
      status: "opened", opened_at: new Date().toISOString(),
    }).select("id").single(), "Booster de fixture");
    checked(await service.from("lottery_card_instances").insert(definitions.map((card, slot) => ({
      user_id: id, card_definition_id: card.id, kq_support_entitlement_id: entitlement.id, pack_slot: slot + 1,
    }))), "Cartes de fixture");
    checked(await service.rpc("rpc_kq_ensure_equipment_profile", { p_user_id: id }), "Portefeuille");
    checked(await service.from("kq_equipment_wallets").update({ cash_cents: 1_000_000 }).eq("user_id", id), "Crédit fictif de recette");
    const jar = new Map();
    const session = createServerClient(status.API_URL, publicKey, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)) },
    });
    checked(await session.auth.signInWithPassword({ email, password }), "Session de recette");
    const age = createHmac("sha256", secret).update("age_verified:true").digest("hex").slice(0, 16);
    accounts.push({ id, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") + `; age_verified=true.${age}` });
  }
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (serverExited) throw new Error("Le serveur de recette s’est arrêté avant le démarrage.");
    try {
      const response = await fetch(`${baseUrl}/api/arena/placard/me`, { signal: AbortSignal.timeout(2000) });
      if (response.status === 401) { ready = true; break; }
    } catch { /* Server compiling. */ }
    await new Promise((done) => setTimeout(done, 1000));
  }
  if (!ready) throw new Error("Serveur de recette non prêt.");
  console.log("Serveur prêt ; vérification des sessions et préparation des parcours.");
  for (const account of accounts) await request(account, "/api/arena/placard/bootstrap");
  const first = accounts[0];
  const second = accounts[1];

  // Real API start, consumable burn, then all six stages through the server.
  const run = await request(first, "/api/arena/placard/runs", { buddieCode: "HH2026-001", deckCodes: ["BOTTE-001", "BOTTE-004"] });
  await fetch(`${baseUrl}/api/arena/placard/runs/${run.runId}/cards`);
  await smoke(first, "card", { PLACARD_SMOKE_RUN_ID: run.runId, PLACARD_SMOKE_CARD_CODE: "BOTTE-004" });
  for (let stage = 0; stage < 6; stage++) {
    for (const action of ["roll", "resolve", "advance"]) {
      await request(first, `/api/arena/placard/runs/${run.runId}/actions`, { action });
    }
  }
  console.log("Culture complète par API : six étapes et création de Fleur validées.");

  // Completed cultures are built by the real deterministic engine; only setup uses service writes.
  async function fixtureFlower(account) {
    let state;
    for (let seed = 1; seed < 100_000; seed++) {
      state = game.startKqGame(seed, { varietyCode: "HH2026-001", deckCodes: ["BOTTE-001"] });
      for (let stage = 0; stage < 6; stage++) state = game.advanceKqStage(game.resolveKqStage(game.rollKqDice(state)));
      const challenges = evaluateKqChallenges(state, { status: "verdict", rounds: [], winner: "opponent" });
      if (state.quality >= 18 && challenges.some((challenge) => challenge.completed)) break;
    }
    if (!state || state.quality < 18) throw new Error("Fixture de qualité introuvable.");
    const flower = createKqFlower(state);
    const row = checked(await service.from("kq_runs").insert({
      user_id: account.id, buddie_card_definition_id: definitions.find((card) => card.code === "HH2026-001").id,
      seed: state.seed, status: "completed", completed_at: state.completedAt,
      deck_codes: state.deckCodes, scenario_codes: state.situationCodes, challenge_day: getKqChallengeDayKey(), state,
    }).select("id").single(), "Culture de fixture");
    return checked(await service.from("kq_flowers").insert({ run_id: row.id, owner_id: account.id,
      variety_code: state.varietyCode, variety_name: flower.variety, quality: state.quality,
      traits: flower.traits, combos: state.combos, battle_stats: flower.stats,
    }).select("id").single(), "Fleur de fixture");
  }
  const botFlower = await fixtureFlower(first);
  await fetch(`${baseUrl}/api/arena/placard/bot-battles`);
  await smoke(first, "bot-challenge", { PLACARD_SMOKE_FLOWER_ID: botFlower.id });
  await smoke(first, "equipment", { PLACARD_SMOKE_EQUIPMENT_CODE: "TENT-120" });

  const flowerOne = await fixtureFlower(first);
  const flowerTwo = await fixtureFlower(second);
  checked(await service.rpc("rpc_kq_enqueue_random_battle", { p_player_id: first.id, p_flower_id: flowerOne.id }), "Mise en file");
  const matched = checked(await service.rpc("rpc_kq_enqueue_random_battle", { p_player_id: second.id, p_flower_id: flowerTwo.id }), "Appariement");
  if (matched.matchStatus !== "matched") throw new Error("Les deux comptes ne se sont pas appariés.");
  await fetch(`${baseUrl}/api/arena/placard/battles/${matched.battleId}/verdict`);
  await smoke(second, "verdict", { PLACARD_SMOKE_BATTLE_ID: matched.battleId });
  await smoke(first, "market", { PLACARD_SMOKE_FLOWER_ID: flowerOne.id,
    PLACARD_SMOKE_EQUIPMENT_CODE: "SIFT-TRAY", PLACARD_SMOKE_MARKET_ROUTE: "dry-sift" });
  console.log("Les cinq scénarios transactionnels sont exécutés sur la base locale.");
} finally {
  server.kill();
}
