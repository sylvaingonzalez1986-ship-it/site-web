// Reproducible local resource study. No account, credentials or remote requests.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const args = process.argv.slice(2);
const pilot = args.includes("--pilot");
assert(args.every(arg => arg === "--pilot" || /^--accounts=\d+$/.test(arg) || /^--cycles=\d+$/.test(arg)), "Use --pilot, --accounts=N, --cycles=N only");
const accounts = Number(args.find(arg => arg.startsWith("--accounts="))?.split("=")[1] ?? (pilot ? 12 : 132));
const cycles = Number(args.find(arg => arg.startsWith("--cycles="))?.split("=")[1] ?? (pilot ? 12 : 30));
assert(Number.isInteger(accounts) && accounts >= 12 && accounts <= 1000 && accounts % 2 === 0);
assert(Number.isInteger(cycles) && cycles >= 12 && cycles <= 30);
const root = process.cwd(), output = resolve(root, "output/placard-support-continuity", pilot ? "pilot" : ".");
const baseTime = Date.parse("2026-10-22T12:00:00Z"), interval = 6 * 3600000;
const policies = ["observe", "prudent", "reserve"];
const channels = ["missions", "training", "peer-pvp"];
const rank = { failure: 0, fragile: 1, success: 2, critical: 3 };
const mix = number => {
  number = Math.imul(number ^ (number >>> 16), 0x45d9f3b);
  number = Math.imul(number ^ (number >>> 16), 0x45d9f3b);
  return (number ^ (number >>> 16)) >>> 0;
};
const rounded = number => Math.round(number * 10000) / 10000;
const sum = values => values.reduce((total, value) => total + value, 0);
const mean = values => values.length ? rounded(sum(values) / values.length) : null;
const countCopies = codes => codes.reduce((counts, code) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }), {});
const size = inventory => sum(Object.values(inventory));
const distribution = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? { min: sorted[0], p10: sorted[Math.floor((sorted.length - 1) * .1)], median: sorted[Math.floor((sorted.length - 1) * .5)], p90: sorted[Math.floor((sorted.length - 1) * .9)], max: sorted.at(-1), mean: mean(values) } : null;
};
const percent = (numerator, denominator) => denominator ? rounded(100 * numerator / denominator) : null;
const sources = [
  "src/lib/kanab-quest-game.ts", "src/lib/kanab-quest-care.ts", "src/lib/kanab-quest-card-preview.ts",
  "src/lib/kanab-quest-economy.ts", "src/lib/kanab-quest-warehouse.ts", "src/lib/kanab-quest-booster.ts",
  "src/lib/kanab-quest-buddie-cultivation.ts", "src/lib/kanab-quest-buddie-rotation.ts", "src/lib/kanab-quest-battle.ts",
  "src/lib/kanab-quest-ranking.ts", "src/lib/kanab-quest-missions.ts", "src/lib/kanab-quest-harvest-tiers.ts",
  "src/lib/kanab-quest-reward-balance.ts", "src/lib/kanab-quest-challenges.ts",
  "src/lib/chanvrier-achievements.json", "src/lib/supabase/kanab-quest-backend.ts",
  "supabase/migrations/20260725000700_kq_defer_inactive_streak_boosters.sql",
  "supabase/migrations/20260726000500_kq_welcome_support_booster.sql",
  "supabase/migrations/20260727000200_kq_bot_victory_card_reward.sql",
  "supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql",
  "supabase/migrations/20260915000100_chanvrier_achievements.sql",
  "supabase/migrations/20260915000200_chanvrier_award_timestamps.sql",
  "supabase/migrations/20261010000500_botte_situations_epic.sql",
  "supabase/migrations/20261015000300_kq_mission_journey.sql",
  "supabase/migrations/20261018000900_kq_harvest_tiers_v2.sql",
];
await mkdir(output, { recursive: true });
const sourceTexts = Object.fromEntries(await Promise.all(sources.map(async path => [path, await readFile(resolve(root, path), "utf8")])));
const sourceHashes = Object.fromEntries(Object.entries(sourceTexts).map(([path, text]) => [path, createHash("sha256").update(text).digest("hex")]));
const vite = await createServer({ root, configFile: false, envDir: false, publicDir: false, cacheDir: resolve(output, "vite-cache"), resolve: { alias: { "@": resolve(root, "src") } }, server: { middlewareMode: true, watch: null, hmr: false } });
const db = new PGlite();
try {
  const [game, warehouseModule, profiles, booster, economy, previewModule, rotation, battle, ranking, missions, tiers, rewardBalance, challenges, achievements] = await Promise.all([
    ...["game", "warehouse", "buddie-cultivation", "booster", "economy", "card-preview", "buddie-rotation", "battle", "ranking", "missions", "harvest-tiers", "reward-balance", "challenges"].map(name => vite.ssrLoadModule(`/src/lib/kanab-quest-${name}.ts`)),
    vite.ssrLoadModule("/src/lib/chanvrier-progress.ts"),
  ]);
  const definitionsSql = sourceTexts["supabase/migrations/20261015000300_kq_mission_journey.sql"].match(/CREATE(?: OR REPLACE)? FUNCTION public\.kq_mission_definitions\(\)[\s\S]*?\$\$;/)?.[0];
  assert(definitionsSql, "Authoritative mission catalog must remain identifiable");
  await db.exec(definitionsSql);
  const definitions = (await db.query("SELECT * FROM public.kq_mission_definitions() ORDER BY code")).rows;
  assert.deepEqual(definitions, missions.KQ_MISSION_DEFINITIONS.map(({ code, track, step, metric, target, reward }) => ({ code, track, step, metric, target, reward })).sort((a, b) => a.code.localeCompare(b.code)), "No outdated mission targets or rewards");
  assert.match(sourceTexts["supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql"], /card_count INTEGER NOT NULL DEFAULT 10/);
  assert.match(sourceTexts["supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql"], /'pvp-win:' \|\| p_battle_id::TEXT, 3/);
  assert.match(sourceTexts["supabase/migrations/20260915000200_chanvrier_award_timestamps.sql"], /FOREACH n IN ARRAY ARRAY\[5,8\]/);
  assert.match(sourceTexts["supabase/migrations/20260727000200_kq_bot_victory_card_reward.sql"], /v_today_count >= 10/);
  assert.match(sourceTexts["supabase/migrations/20260725000700_kq_defer_inactive_streak_boosters.sql"], /v_profile\.streak % 3 <> 0/);
  assert.equal(rewardBalance.KQ_REWARD_BALANCE.training.winnerCardCount, 1);
  assert.equal(rewardBalance.KQ_REWARD_BALANCE.pvp.winnerCardCount, 3);
  // Read the actual three bot definitions without importing the account backend or its environment.
  const backendText = sourceTexts["src/lib/supabase/kanab-quest-backend.ts"];
  const botCatalog = backendText.match(/const KQ_TRAINING_BOTS = \[([\s\S]*?)\] as const;/)?.[1];
  assert(botCatalog, "Training bot catalog must remain identifiable");
  const trainingBots = [...botCatalog.matchAll(/code: "([^"]+)", name: "([^"]+)", variety: "([^"]+)", salt: (\d+)/g)]
    .map(([, code, name, variety, salt]) => ({ code, name, variety, salt: Number(salt) }));
  assert.equal(trainingBots.length, 3);
  assert.match(backendText, /return KQ_TRAINING_BOTS\[Math\.abs\(hash\) % KQ_TRAINING_BOTS\.length\]\.code/);
  assert.equal(game.KQ_HAND_SIZE, 10);
  const warehouse = warehouseModule.getKqWarehouseRunSnapshot(warehouseModule.createKqWarehouseStarter(), 1, "starter");
  assert(warehouse && warehouse.activeAreaM2 === 1);
  const commonBuddies = game.KQ_BUDDIES.filter(item => item.rarity === "common");
  assert.equal(commonBuddies.length, 33);
  const relevantMissions = definitions.filter(item => ["culture", "quality"].includes(item.track)).sort((a, b) => a.track.localeCompare(b.track) || a.step - b.step);
  const allRows = [], summaries = [];
  const settledFlowers = new Set(), trainingDays = new Map();
  const trainingBotEncounters = Object.fromEntries(trainingBots.map(bot => [bot.code, 0]));
  let conservationChecks = 0, rotationsChecked = 0, pvpBattles = 0;

  function grant(account, key, source, cardCount, cycle, fixedCode = null) {
    assert(!account.rewardKeys.has(key), "A reward cannot be granted twice");
    account.rewardKeys.add(key);
    const seed = mix(account.id * 4711 + cycle * 100003 + [...key].reduce((value, character) => value * 31 + character.charCodeAt(0) | 0, 17)) % 100000;
    const cards = fixedCode ? [game.KQ_ACTIVE_CARDS.find(card => card.code === fixedCode)]
      : Array.from({ length: cardCount }, (_, slot) => booster.drawKqSupportCard(seed, slot * 2, source !== "training-win" && slot === 0));
    assert(cards.every(Boolean));
    assert.equal(cards.length, cardCount);
    for (const card of cards) { account.inventory[card.code] = (account.inventory[card.code] ?? 0) + 1; account.received[card.code] = (account.received[card.code] ?? 0) + 1; }
    account.grants.push({ key, source, cycle, codes: cards.map(card => card.code) });
  }
  function makeAccount(id) {
    const pool = [...commonBuddies], buddies = [];
    for (let n = 0; n < 3; n++) buddies.push(pool.splice(mix(id * 37 + n) % pool.length, 1)[0]);
    const account = { id, buddies, inventory: {}, received: {}, burned: {}, rewardKeys: new Set(), grants: [], claims: new Set(), claimLog: [], metrics: {}, achievements: {}, varieties: new Set(), contestVarieties: new Set(), legendaryVarieties: new Set(), recentSituations: [], recentBuddies: [], rank: { ...ranking.createKqRankProfile(), playerId: `sim-${id}` }, wins: 0, duels: 0, rows: [] };
    grant(account, "welcome", "welcome", 10, 0);
    return account;
  }
  function checkConservation(account) {
    for (const [code, received] of Object.entries(account.received)) {
      assert.equal(received, (account.inventory[code] ?? 0) + (account.burned[code] ?? 0));
      assert(Number.isInteger(account.inventory[code]) && account.inventory[code] >= 0);
      conservationChecks++;
    }
  }
  function claimMilestones(account, cycle) {
    for (const definition of relevantMissions) {
      if (account.claims.has(definition.code) || (account.metrics[definition.metric] ?? 0) < definition.target
        || relevantMissions.some(previous => previous.track === definition.track && previous.step < definition.step && !account.claims.has(previous.code))) continue;
      account.claims.add(definition.code);
      account.claimLog.push({ cycle, code: definition.code, reward: definition.reward });
      const reward = definition.reward;
      if (reward.kind === "card") grant(account, `mission:${definition.code}`, "mission-card", 1, cycle, reward.code);
      if (reward.kind === "pack") grant(account, `mission:${definition.code}`, "mission-pack", reward.cardCount, cycle);
      // Cash is recorded as a claim, never converted to points or card purchases.
    }
    const families = achievements.ACHIEVEMENTS.filter(item => (account.achievements[item.code] ?? 0) >= item.thresholds[0]).length;
    for (const threshold of [5, 8]) if (families >= threshold && !account.rewardKeys.has(`families:${threshold}`)) grant(account, `families:${threshold}`, "achievement-pack", 10, cycle);
  }
  function recordHarvest(account, state, cycle) {
    if (game.isKqCultureDead(state)) return;
    account.varieties.add(state.varietyCode);
    const distinction = tiers.getKqHarvestTierProgress(state.quality, state);
    if (state.quality >= 14) account.contestVarieties.add(state.varietyCode);
    if (distinction.legendaryRequirements?.met) account.legendaryVarieties.add(state.varietyCode);
    account.metrics.harvests = (account.metrics.harvests ?? 0) + 1;
    account.metrics.varieties = account.varieties.size;
    account.metrics.beautiful_flowers = (account.metrics.beautiful_flowers ?? 0) + Number(state.quality >= 8);
    account.metrics.contest_flowers = (account.metrics.contest_flowers ?? 0) + Number(state.quality >= 14);
    account.metrics.contest_varieties = account.contestVarieties.size;
    account.metrics.legendary_flowers = (account.metrics.legendary_flowers ?? 0) + Number(distinction.legendaryRequirements?.met);
    account.metrics.legendary_varieties = account.legendaryVarieties.size;
    const increments = {
      "triple-spark": state.history.filter(item => item.dice.length === 3 && item.dice.every(value => value === 6)).length,
      "spark-collector": sum(state.history.map(item => item.dice.filter(value => value === 6).length)),
      "perfect-culture": Number(state.history.length === 6 && distinction.successfulStages === 6),
      "cool-head": Number(state.pressure === 0), "natural-defense": Number(state.combos.includes("PBI ciblée")),
    };
    for (const [key, value] of Object.entries(increments)) account.achievements[key] = (account.achievements[key] ?? 0) + value;
    claimMilestones(account, cycle);
  }
  function opportunity(state, inventory) {
    const visible = game.getKqVisibleActionCards(state).filter(card => inventory[card.code] > 0);
    const playable = visible.filter(card => game.canPlayKqCard(state, card).allowed);
    return { phase: state.phase, stage: state.stageIndex, playable: playable.length, handCopies: game.getKqHandCodes(state).length,
      weakRoll: state.phase === "rolled" && rank[game.previewKqResolution(state).outcome] < 2,
      xpOnly: !playable.length && visible.some(card => card.xpCost > state.xp && game.canPlayKqCard({ ...state, xp: card.xpCost }, card).allowed) };
  }
  // These choices reuse the visible-information policy of audit-placard-ten-card-balance.
  function choosePreparation(state, inventory) {
    const priorities = ["humidity-balance", "clean-cut", "harvest-cool", "bill-relief", "cancel-danger", "reroll-neutral"];
    return game.getKqVisibleActionCards(state).filter(card => card.timing === "before-roll" && card.xpCost <= 1
      && state.xp >= card.xpCost + 1 && priorities.includes(card.effect) && inventory[card.code] > 0 && game.canPlayKqCard(state, card).allowed)
      .sort((a, b) => priorities.indexOf(a.effect) - priorities.indexOf(b.effect) || a.code.localeCompare(b.code))[0];
  }
  function chooseReaction(state, inventory, policy) {
    return game.getKqVisibleActionCards(state).filter(card => card.timing === "after-roll").flatMap(card => {
      const preview = previewModule.getKqCardPlayPreview(state, card, inventory[card.code] ?? 0);
      if (preview?.kind !== "deterministic") return [];
      const { before, after } = preview, savesCulture = before.dead && !after.dead;
      if (after.dead || (card.xpCost > 2 && !savesCulture)) return [];
      if (policy === "reserve" && !savesCulture && rank[before.outcome] >= 2 && (before.health ?? 100) >= 40) return [];
      const improvesOutcome = rank[after.outcome] > rank[before.outcome];
      const improvesHealth = before.health !== null && after.health !== null && after.health - before.health >= 5 && after.quality >= before.quality && after.pressure <= before.pressure;
      return savesCulture || improvesOutcome || improvesHealth ? [{ card, preview, savesCulture }] : [];
    }).sort((a, b) => Number(b.savesCulture) - Number(a.savesCulture) || a.card.xpCost - b.card.xpCost || rank[b.preview.after.outcome] - rank[a.preview.after.outcome] || (b.preview.after.health ?? 0) - (a.preview.after.health ?? 0) || a.card.code.localeCompare(b.card.code))[0]?.card;
  }
  function cultivate(account, cycle, policy, channel) {
    const buddie = account.buddies[(cycle - 1) % 3];
    assert.equal(rotation.getKqBuddieRotationRemaining(buddie.code, account.recentBuddies), 0); rotationsChecked++;
    const stockBefore = size(account.inventory);
    const deck = economy.buildKqRecommendedDeck(buddie.effect, account.inventory, [], buddie.code, { startingXp: 1 }).support;
    for (const [code, count] of Object.entries(countCopies(deck))) assert(count <= account.inventory[code]);
    const seed = mix(account.id * 100003 + cycle * 571 + 0x12bd) % 100000;
    let state = game.startKqGame(seed, { rulesVersion: 3, varietyCode: buddie.code, deckCodes: deck,
      collectionCodes: Object.keys(account.inventory).filter(code => account.inventory[code] > 0), warehouse, startingXp: 1,
      cultivationProfile: profiles.getKqBuddieCultivationProfile(buddie.code), domiciliation: "retired", firstCultureRescue: cycle === 1,
      startedAt: new Date(baseTime + (cycle - 1) * interval).toISOString(), recentSituationCodes: account.recentSituations.flat() });
    account.recentBuddies = rotation.recordKqBuddieUse(buddie.code, account.recentBuddies);
    const phases = [], choices = [], cap = policy === "prudent" ? 3 : policy === "reserve" ? 1 : 0;
    function play(card) {
      assert(account.inventory[card.code] > 0 && game.canPlayKqCard(state, card).allowed);
      const hand = game.getKqHandCodes(state);
      const next = game.playKqCard(state, card.code);
      assert.notEqual(next, state); assert.deepEqual(game.getKqHandCodes(next), hand);
      account.inventory[card.code]--; account.burned[card.code] = (account.burned[card.code] ?? 0) + 1;
      choices.push({ stage: state.stageIndex, code: card.code, phase: state.phase }); state = next;
    }
    while (state.phase !== "complete") {
      phases.push(opportunity(state, account.inventory));
      if (policy === "prudent" && choices.length < cap) { const card = choosePreparation(state, account.inventory); if (card) play(card); }
      state = game.rollKqDice(state); phases.push(opportunity(state, account.inventory));
      if (choices.length < cap) { const card = chooseReaction(state, account.inventory, policy); if (card) play(card); }
      state = game.advanceKqStage(game.resolveKqStage(state));
    }
    assert.equal(state.usedCards.length, choices.length); assert(choices.length <= cap);
    const dead = game.isKqCultureDead(state);
    account.recentSituations = [state.situationCodes.slice(0, dead ? state.stageIndex + 1 : 6), ...account.recentSituations].slice(0, 12);
    const row = { account: account.id, cycle, policy, channel, seed, buddie: buddie.code, stockBefore, deckSize: deck.length,
      emptyAtStart: stockBefore === 0, deckEmpty: deck.length === 0, phaseChoices: phases, choices,
      cardsBurned: choices.length, dead, rescued: state.history.some(item => item.rescued === true), quality: state.quality, health: state.care.vitality,
      stockAfterBurn: size(account.inventory), wholeCultureWithoutPlayable: phases.every(phase => phase.playable === 0), harvestGrams: state.harvestGrams ?? 0 };
    account.rows.push(row); recordHarvest(account, state, cycle); checkConservation(account);
    return { account, state, row, flower: dead ? null : battle.createKqFlower(state) };
  }
  function settleDuel(result, verdict, cycle, channel) {
    const { account } = result;
    const flowerKey = `${channel}:${result.row.policy}:${account.id}:${result.row.cycle}`;
    assert(!settledFlowers.has(flowerKey), "Each produced Flower can be consumed by only one duel");
    settledFlowers.add(flowerKey);
    if (channel === "training") {
      const day = challenges.getKqChallengeDayKey(new Date(baseTime + cycle * interval));
      const key = `${result.row.policy}:${account.id}:${day}`;
      trainingDays.set(key, (trainingDays.get(key) ?? 0) + 1);
      assert(trainingDays.get(key) <= 10, "Training respects its authoritative daily limit");
    }
    const won = verdict.winner === "player"; account.duels++; account.wins += Number(won);
    const jury = Math.round(Math.min(10, Math.max(0, mean(verdict.rounds.map(round => round.playerScore)) / 10)) * 10) / 10;
    if (jury >= 9) account.achievements["jury-favorite"] = (account.achievements["jury-favorite"] ?? 0) + 1;
    if (channel === "training" && won) grant(account, `training:${cycle}`, "training-win", rewardBalance.KQ_REWARD_BALANCE.training.winnerCardCount, cycle);
    if (channel === "peer-pvp") {
      account.rank = ranking.applyKqBattleToRanking(account.rank, verdict, 1000);
      if (won) {
        grant(account, `pvp:${verdict.id}`, "pvp-win", rewardBalance.KQ_REWARD_BALANCE.pvp.winnerCardCount, cycle);
        if (verdict.rounds.every(round => round.winner === "player")) account.achievements["perfect-victory"] = (account.achievements["perfect-victory"] ?? 0) + 1;
        if (account.rank.streak > 0 && account.rank.streak % 3 === 0) grant(account, `streak:${account.rank.wins}:${account.rank.streak}`, "streak-pack", 10, cycle);
      }
    }
    claimMilestones(account, cycle); checkConservation(account);
  }
  function summarizeRows(rows) {
    const phases = rows.flatMap(row => row.phaseChoices), preparations = phases.filter(phase => phase.phase === "prepare"), weak = phases.filter(phase => phase.weakRoll);
    return { cycles: rows.length, stockAtStart: distribution(rows.map(row => row.stockBefore)), preparedDeck: distribution(rows.map(row => row.deckSize)),
      emptyCollectionPercent: percent(rows.filter(row => row.emptyAtStart).length, rows.length), noPlayableAllCulturePercent: percent(rows.filter(row => row.wholeCultureWithoutPlayable).length, rows.length),
      noPreparationPercent: percent(preparations.filter(phase => phase.playable === 0).length, preparations.length),
      weakRollWithoutReactionPercent: percent(weak.filter(phase => phase.playable === 0).length, weak.length), weakRollCount: weak.length,
      cardsBurnedMean: mean(rows.map(row => row.cardsBurned)), deathPercent: percent(rows.filter(row => row.dead).length, rows.length), qualityMean: mean(rows.map(row => row.quality)) };
  }
  for (const channel of channels) for (const policy of policies) {
    const cohort = Array.from({ length: accounts }, (_, index) => makeAccount(index + 1));
    let waiting = [];
    for (let cycle = 1; cycle <= cycles; cycle++) {
      const results = cohort.map(account => cultivate(account, cycle, policy, channel));
      const now = new Date(baseTime + cycle * interval);
      if (channel === "training") for (const result of results.filter(result => result.flower)) {
        const ownerId = `00000000-0000-4000-8000-${String(result.account.id).padStart(12, "0")}`;
        const flowerId = `00000000-0000-4000-8000-${String(result.account.id * 100 + cycle).padStart(12, "0")}`;
        const dayKey = challenges.getKqChallengeDayKey(now);
        const hash = [...`${ownerId}:${flowerId}:${dayKey}`].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) | 0, 17);
        const definition = trainingBots[Math.abs(hash) % trainingBots.length];
        const seed = (mix(result.account.id * 982451653 + cycle * 7879) % 100000) + definition.salt;
        trainingBotEncounters[definition.code]++;
        const opponent = battle.createKqOpponent(seed, { ownerName: definition.name, variety: definition.variety, rating: 1000 + (result.state.quality - 12) * 12, rulesVersion: 3 });
        settleDuel(result, battle.resolveKqBattle(battle.lockKqBattle(result.flower, opponent, seed), seed, now), cycle, channel);
      }
      if (channel === "peer-pvp") {
        waiting.push(...results.filter(result => result.flower));
        waiting.sort((a, b) => mix(a.row.seed + cycle * 17) - mix(b.row.seed + cycle * 17));
        while (waiting.length >= 2) {
          const otherIndex = waiting.findIndex((result, index) => index > 0 && result.account.id !== waiting[0].account.id);
          if (otherIndex < 0) break;
          const right = waiting.splice(otherIndex, 1)[0], left = waiting.shift();
          const seed = mix(left.row.seed + right.row.seed * 47 + cycle * 37) % 100000;
          pvpBattles++;
          const verdict = { ...battle.resolveKqBattle(battle.lockKqBattle(left.flower, right.flower, seed), seed, now), id: `study:${cycle}:${left.account.id}:${left.row.cycle}:${right.account.id}:${right.row.cycle}` };
          settleDuel(left, verdict, cycle, channel); settleDuel(right, battle.invertKqBattlePerspective(verdict), cycle, channel);
        }
      }
      for (const result of results) {
        result.row.stockAfterRewards = size(result.account.inventory);
        result.row.grantedThisCycle = sum(result.account.grants.filter(item => item.cycle === cycle).map(item => item.codes.length));
      }
    }
    const rows = cohort.flatMap(account => account.rows), grants = cohort.flatMap(account => account.grants);
    const summary = { channel, policy, accounts, ...summarizeRows(rows),
      checkpoints: [1, 6, 12, 20, 30].filter(cycle => cycle <= cycles).map(cycle => ({ cycle, ...summarizeRows(rows.filter(row => row.cycle === cycle)) })),
      endingInventory: distribution(cohort.map(account => size(account.inventory))),
      accountsEverEmpty: cohort.filter(account => account.rows.some(row => row.emptyAtStart)).length,
      accountsEverWithoutChoice: cohort.filter(account => account.rows.some(row => row.wholeCultureWithoutPlayable)).length,
      firstCultureWithoutChoice: distribution(cohort.flatMap(account => { const row = account.rows.find(row => row.wholeCultureWithoutPlayable); return row ? [row.cycle] : []; })),
      grants: Object.fromEntries([...new Set(grants.map(grant => grant.source))].map(source => [source, { grants: grants.filter(grant => grant.source === source).length, cards: sum(grants.filter(grant => grant.source === source).map(grant => grant.codes.length)) }])),
      missionClaims: Object.fromEntries(relevantMissions.map(mission => [mission.code, cohort.filter(account => account.claims.has(mission.code)).length])),
      duelWins: sum(cohort.map(account => account.wins)), duels: sum(cohort.map(account => account.duels)), unmatchedFlowers: waiting.length,
      accountAudit: cohort.map(account => ({ account: account.id, buddies: account.buddies.map(item => item.code), received: size(account.received), burned: size(account.burned), remaining: size(account.inventory), claims: account.claimLog, grants: account.grants })),
    };
    summaries.push(summary); allRows.push(...rows);
    console.log(JSON.stringify({ channel, policy, endingInventory: summary.endingInventory, noPlayableAllCulturePercent: summary.noPlayableAllCulturePercent, cycleLast: summary.checkpoints.at(-1), grants: summary.grants }));
  }
  const report = { version: 1, generatedAt: new Date().toISOString(), pilot, accountsPerScenario: accounts, cyclesPerAccount: cycles, cultures: allRows.length,
    sourceHashes, validation: { conservationChecks, rotationsChecked, pvpBattles, flowersConsumedOnce: settledFlowers.size, maximumDailyTraining: Math.max(0, ...trainingDays.values()), trainingBotEncounters, authoritativeMissionCatalogMatched: true },
    assumptions: {
      starter: "Trois Buddies communs distincts parmi les 33, kit réellement offert 1 m², une seule zone, un pack de bienvenue de 10 soutiens ; aucune rareté écartée ni remplacée.",
      culture: "Moteur v3 et main de dix actuels ; retired ×1 ; XP initial 1 ; secours uniquement au premier cycle ; rotation A/B/C validée ; historique des situations réellement atteintes sur douze cultures.",
      choices: "observe : aucune carte. prudent : politique visible de l’audit main10, maximum trois cartes par culture. reserve : aucune préparation, maximum une réaction déterministe qui améliore un résultat faible ou une santé <40, ou sauve la culture. Aucun lancer futur inspecté.",
      deck: "Deck conseillé recalculé avant chaque culture à partir des copies restantes. Pas de relance aléatoire, Héritage, changement de main ou soin payant. Copie brûlée conservée absente jusqu’à une vraie récompense simulée.",
      cadence: "Une culture toutes les six heures ; au plus quatre entraînements par jour, sous la limite de dix. Le temps est une hypothèse du scénario, pas une obligation de connexion.",
      training: "Trois bots lus dans le catalogue serveur, sélection par le même hash compte/Fleur/jour de Paris avec des identifiants fictifs stables. Même générateur, variété et adaptation à la qualité ; graine reproductible avec le sel du bot au lieu de Date.now(). Une carte seulement à la victoire, une Fleur consommée par duel, aucun effet sur la série PvP.",
      missions: "Catalogue SQL exécuté localement et comparé au TS. Seulement parcours culture/qualité fondés sur les récoltes produites, prérequis réclamés dans l’ordre, attribution unique. L’argent gagné n’achète aucun point ni pack.",
      rewards: "Collection supposée active et récompenses ouvertes après chaque résultat. Pack standard avec première commune garantie ; carte bot isolée sans garantie commune. Succès cumulés d’après dés/récoltes/jury/PvP ; packs uniques aux cinq et huit familles. Aucune victoire inventée.",
      pvp: "Récoltes réellement simulées appariées aléatoirement au sein d’une cohorte homogène et d’une politique identique ; reliquat conservé. Le moteur tranche chaque duel ; un pack de trois au vainqueur et dix à chaque troisième victoire consécutive. Ce pool n’est pas le matchmaking réel.",
    },
    limitations: [
      "Étude de continuité des soutiens, pas simulation économique complète : ni ventes, trésorerie, factures, usure, entretien ni agrandissements ; les trente cycles sont conditionnels au maintien du kit, pas une preuve qu’ils sont finançables sans vendre.",
      "Missions de préparation/commerce, transformations, arômes, packs Carnet/communauté/saison et achats exclus faute d’actions correspondantes simulées. Aucune récompense de ces sources n’est supposée nulle dans le jeu réel.",
      "Le scénario missions garde ses Fleurs sans duel ; entraînement/PvP les consomment. Les résultats de compétition dépendent du générateur bot ou du pool fictif de pairs, pas de joueurs observés.",
      "Tirages reproductibles avec le sampler TS et les raretés locales, pas la source cryptographique du serveur. États et récompenses projetés en mémoire ; seuls les catalogues SQL sont exécutés, pas les RPC de compte ni leurs délais.",
      "Une collection non vide peut n’offrir aucune carte jouable pendant une culture. Aucun seuil de réapprovisionnement automatique ni dotation nouvelle n’est déduit de ce seul scénario.",
      "Ces résultats ne mesurent ni rétention, ni ennui, ni stratégie optimale ; aucune donnée de compte réel et aucune mutation distante.",
    ], summaries };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, "samples.json"), JSON.stringify(allRows));
  const lines = ["# Continuité des soutiens sur plusieurs cultures", "", `${allRows.length.toLocaleString("fr-FR")} cultures simulées : ${accounts} comptes × ${cycles} cycles × trois politiques × trois circuits. ${pilot ? "Pilote technique, pas le rapport final." : "Rapport local final sous les hypothèses ci-dessous."}`, "",
    "| Circuit | Politique | Stock final médian | Cycles sans aucun choix | Sans choix au dernier cycle | Cartes jouées/culture | Mortalité |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(item => `| ${item.channel} | ${item.policy} | ${item.endingInventory.median} | ${item.noPlayableAllCulturePercent} % | ${item.checkpoints.at(-1).noPlayableAllCulturePercent} % | ${item.cardsBurnedMean} | ${item.deathPercent} % |`), "",
    "## Hypothèses", "", ...Object.entries(report.assumptions).map(([key, value]) => `- **${key}** : ${value}`), "", "## Limites", "", ...report.limitations.map(value => `- ${value}`), "", "## Vérifications", "", `${conservationChecks} égalités copie reçue = copie restante + copie brûlée ; ${rotationsChecked} lancements compatibles avec la rotation ; catalogue des missions identique au SQL.`, "", "Les quantiles et étapes 1/6/12/20/30, provenances de toutes les récompenses et contrôles par compte figurent dans report.json. Les observations par phase figurent dans samples.json.", ""];
  await writeFile(resolve(output, "report.md"), lines.join("\n"));
  console.log(`Saved ${allRows.length} cultures to ${output}`);
} finally { await db.close(); await vite.close(); }
