// Local paired scenario study. No credentials, environment files or remote calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const output = resolve(root, "output/placard-ten-card-balance");
const seedArgument = process.argv.slice(2).find(argument => /^--seeds=\d+$/.test(argument));
if (process.argv.slice(2).some(argument => argument !== seedArgument)) throw new Error("Usage: node scripts/audit-placard-ten-card-balance.mjs [--seeds=330]");
const seedCount = seedArgument ? Number(seedArgument.split("=")[1]) : 330;
assert(Number.isSafeInteger(seedCount) && seedCount >= 300 && seedCount <= 10000, "Use 300–10000 paired seeds per environment");
const startedAt = "2026-10-20T12:00:00.000Z";
const outcomeRank = { failure: 0, fragile: 1, success: 2, critical: 3 };
const policies = ["no-cards-played", "prudent"];
const environments = [1, 3].flatMap(packs => [true, false].map(firstCultureRescue => ({
  id: `${packs}-pack-${firstCultureRescue ? "first-rescue" : "no-rescue"}`, packs, firstCultureRescue,
})));
const mix = number => {
  number = Math.imul(number ^ (number >>> 16), 0x45d9f3b);
  number = Math.imul(number ^ (number >>> 16), 0x45d9f3b);
  return (number ^ (number >>> 16)) >>> 0;
};
const round = value => Math.round(value * 10000) / 10000;
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const distribution = values => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const quantile = fraction => ordered[Math.floor((ordered.length - 1) * fraction)];
  return { count: values.length, min: ordered[0], p10: quantile(.1), median: quantile(.5), p90: quantile(.9), max: ordered.at(-1), mean: round(average(values)) };
};
const countCopies = codes => codes.reduce((counts, code) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }), {});

await mkdir(output, { recursive: true });
const sourceNames = ["kanab-quest-game", "kanab-quest-care", "kanab-quest-card-preview", "kanab-quest-turn-preview", "kanab-quest-economy", "kanab-quest-warehouse", "kanab-quest-booster", "kanab-quest-buddie-cultivation"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, createHash("sha256").update(await readFile(resolve(root, `src/lib/${name}.ts`))).digest("hex")])));
const vite = await createServer({
  root, configFile: false, envDir: false, publicDir: false, cacheDir: resolve(output, "vite-cache"),
  resolve: { alias: { "@": resolve(root, "src") } },
  server: { middlewareMode: true, watch: null, hmr: false },
});

try {
  const [game, warehouseModule, profiles, booster, economy, previewModule] = await Promise.all([
    "game", "warehouse", "buddie-cultivation", "booster", "economy", "card-preview",
  ].map(name => vite.ssrLoadModule(`/src/lib/kanab-quest-${name}.ts`)));
  assert.equal(game.KQ_HAND_SIZE, 10, "This comparison is specifically for the current ten-card engine");
  const starter = warehouseModule.createKqWarehouseStarter();
  const warehouse = warehouseModule.getKqWarehouseRunSnapshot(starter, 1, "starter");
  assert(warehouse && warehouse.activeAreaM2 === 1, "Use the actual offered starter culture room");
  const commonBuddies = game.KQ_BUDDIES.filter(buddie => buddie.rarity === "common");
  assert.equal(commonBuddies.length, 33);

  // The unchanged production draw returns ten deterministic physical copies.
  // Taking its prefix reproduces a five-card limit, without modifying the engine
  // or refilling the hand mid-stage. No Heritage reserve or redraw is modelled.
  function capNewHand(state, handSize) {
    assert.equal(state.phase, "prepare");
    const productionHand = game.getKqHandCodes(state);
    assert(productionHand.length <= 10);
    return { ...state, handCodes: productionHand.slice(0, handSize) };
  }

  function opportunity(state, inventory) {
    const visible = game.getKqVisibleActionCards(state);
    const remaining = visible.filter(card => (inventory[card.code] ?? 0) > 0);
    const playable = remaining.filter(card => game.canPlayKqCard(state, card).allowed);
    const xpOnly = !playable.length && remaining.some(card => state.xp < card.xpCost
      && game.canPlayKqCard({ ...state, xp: card.xpCost }, card).allowed);
    return {
      stageIndex: state.stageIndex, phase: state.phase === "prepare" ? "preparation" : "reaction",
      visibleOutcome: state.phase === "rolled" ? game.previewKqResolution(state)?.outcome ?? null : null,
      xp: state.xp, handCopies: game.getKqHandCodes(state).length,
      playable: playable.length, unavailable: playable.length === 0,
      blocker: playable.length ? null : xpOnly ? "xp-only" : "other",
    };
  }

  function choosePreparation(state, inventory) {
    // A public, fixed preference: never rolls the candidate or inspects a seed.
    // Retain one XP; spend only one XP on a relevant preparation.
    const priorities = ["humidity-balance", "clean-cut", "harvest-cool", "bill-relief", "cancel-danger", "reroll-neutral"];
    return game.getKqVisibleActionCards(state).filter(card => card.timing === "before-roll"
      && card.xpCost <= 1 && state.xp >= card.xpCost + 1 && priorities.includes(card.effect)
      && (inventory[card.code] ?? 0) > 0 && game.canPlayKqCard(state, card).allowed)
      .sort((left, right) => priorities.indexOf(left.effect) - priorities.indexOf(right.effect) || left.code.localeCompare(right.code))[0];
  }

  function chooseReaction(state, inventory) {
    // The same public preview as the UI: a closed allowlist excludes every
    // random reaction before playKqCard is called. No future stage is examined.
    const candidates = game.getKqVisibleActionCards(state).filter(card => card.timing === "after-roll")
      .flatMap(card => {
        const preview = previewModule.getKqCardPlayPreview(state, card, inventory[card.code] ?? 0);
        if (preview?.kind !== "deterministic") return [];
        const { before, after } = preview;
        const savesCulture = before.dead && !after.dead;
        if (after.dead || (card.xpCost > 2 && !savesCulture)) return [];
        const improvesOutcome = outcomeRank[after.outcome] > outcomeRank[before.outcome];
        const improvesHealth = before.health !== null && after.health !== null && after.health - before.health >= 5
          && after.quality >= before.quality && after.pressure <= before.pressure;
        return savesCulture || improvesOutcome || improvesHealth ? [{ card, preview, savesCulture }] : [];
      });
    candidates.sort((left, right) => Number(right.savesCulture) - Number(left.savesCulture)
      || left.card.xpCost - right.card.xpCost
      || outcomeRank[right.preview.after.outcome] - outcomeRank[left.preview.after.outcome]
      || (right.preview.after.health ?? 0) - (left.preview.after.health ?? 0)
      || left.card.code.localeCompare(right.card.code));
    return candidates[0]?.card;
  }

  function simulate({ pairIndex, seed, buddie, deckCodes, initialInventory, environment, policy, handSize }) {
    const inventory = { ...initialInventory };
    let state = capNewHand(game.startKqGame(seed, {
      rulesVersion: 3, varietyCode: buddie.code, deckCodes: [...deckCodes],
      collectionCodes: Object.keys(inventory), warehouse, startingXp: 1,
      cultivationProfile: profiles.getKqBuddieCultivationProfile(buddie.code),
      domiciliation: "home", firstCultureRescue: environment.firstCultureRescue, startedAt,
    }), handSize);
    assert.equal(state.xp, 1, "Common Buddie without Heritage, tokens or career bonus");
    assert.equal(state.heritageCode, undefined);
    assert.equal(state.rulesVersion, 3);
    const phases = [], choices = [];
    let spentXp = 0;
    function play(card) {
      const handBefore = [...game.getKqHandCodes(state)];
      assert((inventory[card.code] ?? 0) > 0);
      assert(game.canPlayKqCard(state, card).allowed);
      const played = game.playKqCard(state, card.code);
      assert.notEqual(played, state);
      assert.equal(played.usedCards.length, state.usedCards.length + 1);
      assert.deepEqual(game.getKqHandCodes(played), handBefore, "No replacement card is drawn after a burn");
      choices.push({ stageIndex: state.stageIndex, phase: state.phase, code: card.code, costXp: card.xpCost });
      spentXp += state.xp - played.xp;
      inventory[card.code]--;
      state = played;
    }
    while (state.phase !== "complete") {
      assert.equal(state.phase, "prepare");
      assert(state.history.length < 6);
      phases.push(opportunity(state, inventory));
      if (policy === "prudent" && choices.length < 3) {
        const preparation = choosePreparation(state, inventory);
        if (preparation) play(preparation);
      }
      state = game.rollKqDice(state);
      assert.equal(state.phase, "rolled");
      phases.push(opportunity(state, inventory));
      if (policy === "prudent" && choices.length < 3) {
        const reaction = chooseReaction(state, inventory);
        if (reaction) play(reaction);
      }
      state = game.advanceKqStage(game.resolveKqStage(state));
      if (state.phase !== "complete") state = capNewHand(state, handSize);
    }
    assert.equal(phases.length, state.history.length * 2);
    assert.equal(state.usedCards.length, choices.length);
    assert(choices.length <= (policy === "prudent" ? 3 : 0));
    const burns = countCopies(state.usedCards), initialDeck = countCopies(deckCodes);
    for (const [code, copies] of Object.entries(initialInventory)) {
      assert.equal(inventory[code] + (burns[code] ?? 0), copies, "Inventory copies are conserved exactly");
      assert((burns[code] ?? 0) <= (initialDeck[code] ?? 0), "No card outside the prepared deck is burned");
    }
    assert(state.care && Number.isFinite(state.care.vitality));
    return {
      environment: environment.id, pairIndex, seed, buddie: buddie.code, policy, handSize,
      initialDeck: deckCodes, startingCollectionCopies: Object.values(initialInventory).reduce((sum, value) => sum + value, 0),
      phases, choices, cardsBurned: state.usedCards.length, spentXp,
      dead: game.isKqCultureDead(state), rescued: state.history.some(stage => stage.rescued === true),
      health: state.care.vitality, quality: state.quality, xp: state.xp, pressure: state.pressure,
      stages: state.history.length, harvestGrams: state.harvestGrams ?? 0,
      successfulStages: state.history.filter(stage => ["success", "critical"].includes(stage.outcome)).length,
      criticalStages: state.history.filter(stage => stage.outcome === "critical").length,
      failedStages: state.history.filter(stage => stage.outcome === "failure").length,
      trace: state.history.map(stage => ({ dice: stage.dice, outcome: stage.outcome, qualityDelta: stage.qualityDelta, xpGain: stage.xpGain, pressure: stage.pressureAfter })),
    };
  }

  const rows = [];
  let identicalNoCardPairs = 0;
  for (const environment of environments) {
    for (let pairIndex = 1; pairIndex <= seedCount; pairIndex++) {
      const seed = mix(pairIndex * 101 + 0x71a3) % 100000;
      const buddie = commonBuddies[(pairIndex - 1) % commonBuddies.length];
      const cards = Array.from({ length: environment.packs }, (_, pack) =>
        booster.openKqSupportBooster(mix(pairIndex * 37 + pack * 100003 + 0x340f) % 100000)).flat();
      const initialInventory = countCopies(cards.map(card => card.code));
      const deckCodes = economy.buildKqRecommendedDeck(buddie.effect, initialInventory, [], buddie.code, { startingXp: 1 }).support;
      assert(deckCodes.length > 0 && deckCodes.length <= 10);
      for (const policy of policies) {
        const pair = [5, 10].map(handSize => simulate({ pairIndex, seed, buddie, deckCodes, initialInventory, environment, policy, handSize }));
        assert.deepEqual(pair[0].initialDeck, pair[1].initialDeck);
        if (policy === "no-cards-played") {
          for (const key of ["dead", "rescued", "health", "quality", "xp", "pressure", "stages", "harvestGrams", "trace"]) {
            assert.deepEqual(pair[0][key], pair[1][key], `Unplayed hand size must not change ${key}`);
          }
          identicalNoCardPairs++;
        }
        rows.push(...pair);
      }
    }
    console.log(`Completed ${environment.id}: ${seedCount} paired seeds × 2 policies × 2 hands.`);
  }

  function summarizePhase(events) {
    const unavailable = events.filter(event => event.unavailable);
    return {
      observed: events.length, noChoice: unavailable.length,
      noChoicePercent: events.length ? round(unavailable.length / events.length * 100) : null,
      xpOnly: unavailable.filter(event => event.blocker === "xp-only").length,
      other: unavailable.filter(event => event.blocker === "other").length,
      meanPlayableChoices: average(events.map(event => event.playable)) === null ? null : round(average(events.map(event => event.playable))),
    };
  }
  function summarize(samples) {
    const events = samples.flatMap(sample => sample.phases);
    return {
      environment: samples[0].environment, policy: samples[0].policy, handSize: samples[0].handSize, runs: samples.length,
      deaths: samples.filter(sample => sample.dead).length,
      deathPercent: round(samples.filter(sample => sample.dead).length / samples.length * 100),
      rescuePercent: round(samples.filter(sample => sample.rescued).length / samples.length * 100),
      qualityAllRuns: distribution(samples.map(sample => sample.quality)),
      qualityHarvestedOnly: distribution(samples.filter(sample => !sample.dead).map(sample => sample.quality)),
      health: distribution(samples.map(sample => sample.health)),
      cardsBurned: distribution(samples.map(sample => sample.cardsBurned)),
      spentXp: distribution(samples.map(sample => sample.spentXp)),
      successfulStages: distribution(samples.map(sample => sample.successfulStages)),
      criticalStages: distribution(samples.map(sample => sample.criticalStages)),
      failedStages: distribution(samples.map(sample => sample.failedStages)),
      initialDeckCopies: distribution(samples.map(sample => sample.initialDeck.length)),
      deckCardSelections: Object.fromEntries([...new Set(samples.flatMap(sample => sample.initialDeck))].sort().map(code => [code,
        { copies: samples.reduce((sum, sample) => sum + sample.initialDeck.filter(item => item === code).length, 0),
          cultures: samples.filter(sample => sample.initialDeck.includes(code)).length },
      ])),
      preparation: summarizePhase(events.filter(event => event.phase === "preparation")),
      reaction: summarizePhase(events.filter(event => event.phase === "reaction")),
      reactionOnWeakRoll: summarizePhase(events.filter(event => event.phase === "reaction" && ["failure", "fragile"].includes(event.visibleOutcome))),
      byStage: Array.from({ length: 6 }, (_, stageIndex) => ({ stageIndex, stage: game.KQ_STAGES[stageIndex],
        preparation: summarizePhase(events.filter(event => event.stageIndex === stageIndex && event.phase === "preparation")),
        reaction: summarizePhase(events.filter(event => event.stageIndex === stageIndex && event.phase === "reaction")),
      })),
    };
  }
  const summaries = environments.flatMap(environment => policies.flatMap(policy => [5, 10].map(handSize =>
    summarize(rows.filter(row => row.environment === environment.id && row.policy === policy && row.handSize === handSize)))));
  const comparisons = environments.flatMap(environment => policies.map(policy => {
    const pairRows = [5, 10].map(handSize => rows.filter(row => row.environment === environment.id && row.policy === policy && row.handSize === handSize));
    const [before, after] = [5, 10].map(handSize => summaries.find(summary => summary.environment === environment.id && summary.policy === policy && summary.handSize === handSize));
    return {
      environment: environment.id, policy, pairs: pairRows[0].length,
      preparationNoChoicePercentagePointChange: round(after.preparation.noChoicePercent - before.preparation.noChoicePercent),
      reactionNoChoicePercentagePointChange: round(after.reaction.noChoicePercent - before.reaction.noChoicePercent),
      weakRollReactionNoChoicePercentagePointChange: round(after.reactionOnWeakRoll.noChoicePercent - before.reactionOnWeakRoll.noChoicePercent),
      deathPercentagePointChange: round(after.deathPercent - before.deathPercent),
      meanQualityChangeAllRuns: round(after.qualityAllRuns.mean - before.qualityAllRuns.mean),
      meanBurnedCardsChange: round(after.cardsBurned.mean - before.cardsBurned.mean),
      pairedQualityChange: distribution(pairRows[1].map((row, index) => row.quality - pairRows[0][index].quality)),
      survivalGained: pairRows[1].filter((row, index) => !row.dead && pairRows[0][index].dead).length,
      survivalLost: pairRows[1].filter((row, index) => row.dead && !pairRows[0][index].dead).length,
    };
  }));
  const report = {
    scope: "Paired local scenarios isolating the hand limit, using the current v3 engine. Not observed players or a full historical version replay.",
    createdAt: new Date().toISOString(), seedCountPerEnvironmentPolicyHand: seedCount, totalCultures: rows.length,
    seedMethod: "mix(pairIndex*101+0x71a3)%100000; identical underlying seed and booster collection within each pair",
    sourceHashes, environments, policies,
    settings: {
      rulesVersion: 3, startingXp: 1, heritage: null, tokens: 0, careerBonus: 0,
      startingGameBudgetEuros: 1000, budgetModelled: false, paidCare: false, optionalEquipment: false,
      buddieRarity: "common", buddieCount: commonBuddies.length, handRedraws: 0, maxPrudentBurnsPerCulture: 3,
      collection: "Current local ordinary-booster sampler, ten cards each; no rarity discarded and no reroll of a duplicate. Does not reproduce remote quota accounting.",
      deck: "Current recommended deck built once from owned copies, then kept identical in each pair; at most ten physical copies and one epic. Historical recommendation logic is not simulated.",
      historicalFive: "Only at start and stage advance: take the first five entries of the actual deterministic ten-card draw. No mid-stage redistribution, no core edits.",
      prudentPreparation: "Fixed preference among compatible one-XP preparations; retain one XP, no dice or seed lookahead.",
      prudentReaction: "Only the public deterministic card preview, cheapest improvement to outcome or >=5 health with no quality/pressure loss; max 2 XP unless the card prevents immediate death. No random reaction is simulated or played.",
      noCardsReference: "Same collection and prepared deck, but no card is played. This permits choice-availability measurement and an invariant outcome control.",
      warehouse: { activeAreaM2: warehouse.activeAreaM2, energyCostCents: warehouse.energyCostCents,
        consumablesCostCents: warehouse.consumablesCostCents, operatingCostCents: warehouse.operatingCostCents,
        dryingCapacityGrams: warehouse.dryingCapacityGrams, storageCapacityGrams: warehouse.storageCapacityGrams,
        offeredLayout: starter },
    },
    measurements: {
      opportunities: "One observation before any preparation and one after the real roll, before any reaction, on each actually reached stage. Death censors later stages; denominators are included.",
      weakRolls: "Reaction opportunities are also reported separately for visible fragile/failure rolls. An unavailable reaction on a successful or critical roll is not itself a problem.",
      noChoiceXpOnly: "No legal choice now, but at least one owned, in-hand card becomes legal by increasing XP to its cost without any other change.",
      quality: "Culture points. All-run quality includes failed runs; harvested-only quality uses surviving runs. Neither is a jury or commercial score.",
      consumption: "Every actually played copy is removed from the same finite inventory immediately; the stage hand is not refilled. No rewards or new packs arrive during a culture.",
    },
    validation: { identicalNoCardPairs, expectedNoCardPairs: seedCount * environments.length, inventoryConservation: true, noMidStageRefill: true },
    limitations: [
      "Une culture de six étapes au maximum par compte fictif : aucune conclusion sur l’épuisement de la collection à long terme, les missions, contrats, ventes, revenus ou retours des joueurs.",
      "Cette politique économe fixe ne représente ni un joueur optimal, ni des comportements observés. Elle ne prédit pas le bénéfice d’une préparation et n’utilise aucune réaction aléatoire.",
      "Aucun soin payant, Héritage, métier ou bonus d’XP, pièce supplémentaire ni changement de main : plusieurs stratégies utiles sont volontairement exclues.",
      "Les paires partagent le hasard initial, mais leurs lancers réels suivants peuvent diverger si des préparations différentes consomment des tirages. Les dépenses, décès et copies consommées modifient aussi leurs choix ultérieurs.",
      "La condition cinq cartes conserve les effets, soins, règles d’XP et recommandations de deck actuels. Elle ne reconstitue pas intégralement l’ancien équilibrage.",
      "Les boosters suivent le générateur local, pas les allocations ni quotas distants. Les collections sont des hypothèses ; le scénario trois packs ne signifie pas qu’ils sont tous offerts au départ.",
    ],
    summaries, comparisons,
  };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, "samples.json"), JSON.stringify(rows));
  const lines = [
    "# Comparaison locale : mains de cinq et dix cartes", "",
    `${rows.length} cultures simulées ; ${seedCount} seeds par environnement, politique et taille de main. Moteur v3 réel, kit offert, Buddie commun, 1 XP initial, aucun Héritage ni soin payant.`, "",
    "La main de cinq est une condition contrôlée du moteur actuel, pas une reconstitution complète de l’ancien jeu. Le deck et la collection de chaque paire sont identiques. Les copies jouées sont consommées et la main reste figée pendant l’étape.", "",
    "| Collection / secours | Politique | Sans choix préparation : 5 → 10 | Sans choix réaction : 5 → 10 | Mortalité : 5 → 10 | Qualité moyenne : 5 → 10 | Cartes jouées : 5 → 10 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...comparisons.map(comparison => {
      const [five, ten] = [5, 10].map(handSize => summaries.find(row => row.environment === comparison.environment && row.policy === comparison.policy && row.handSize === handSize));
      const percentage = value => `${value.toFixed(1)} %`;
      return `| ${comparison.environment} | ${comparison.policy} | ${percentage(five.preparation.noChoicePercent)} → ${percentage(ten.preparation.noChoicePercent)} | ${percentage(five.reaction.noChoicePercent)} → ${percentage(ten.reaction.noChoicePercent)} | ${percentage(five.deathPercent)} → ${percentage(ten.deathPercent)} | ${five.qualityAllRuns.mean.toFixed(2)} → ${ten.qualityAllRuns.mean.toFixed(2)} | ${five.cardsBurned.mean.toFixed(2)} → ${ten.cardsBurned.mean.toFixed(2)} |`;
    }), "",
    "Les phases non atteintes après une mort sont exclues du taux sans choix ; les dénominateurs, blocages XP seuls, autres blocages et résultats par étape sont dans report.json. Les points de Qualité ci-dessus incluent les cultures mortes et ne sont pas une note de jury.", "",
    "Un bon lancer peut ne nécessiter aucune réaction. Pour éviter de compter cela comme un blocage, voici les seuls lancers fragiles ou ratés de la stratégie économe :", "",
    "| Collection / secours | Sans réaction jouable : 5 → 10 | Phases observées : 5 / 10 | Blocage XP seul, main de 10 | Autres blocages, main de 10 |",
    "| --- | --- | --- | --- | --- |",
    ...environments.map(environment => {
      const [five, ten] = [5, 10].map(handSize => summaries.find(row => row.environment === environment.id && row.policy === "prudent" && row.handSize === handSize).reactionOnWeakRoll);
      return `| ${environment.id} | ${five.noChoicePercent.toFixed(1)} % → ${ten.noChoicePercent.toFixed(1)} % | ${five.observed} / ${ten.observed} | ${ten.xpOnly} | ${ten.other} |`;
    }), "",
    `Contrôle : ${identicalNoCardPairs} paires sans carte jouée ont exactement les mêmes dés, résultats, santé, Qualité et XP quelle que soit la taille de main. Conservation des copies et absence de remplacement pendant l’étape vérifiées dans chaque culture.`, "",
    "## Limites", "", ...report.limitations.map(limitation => `- ${limitation}`), "",
    "Cette simulation ne mesure ni la rétention, ni l’ennui, ni l’économie réelle. Elle ne justifie pas à elle seule un changement de coût, d’XP ou de difficulté.", "",
    "Reproduction : `node scripts/audit-placard-ten-card-balance.mjs --seeds=330`. Tous les résultats restent locaux ; aucun compte, fichier d’environnement ou service distant n’est utilisé.", "",
  ];
  await writeFile(resolve(output, "report.md"), lines.join("\n"));
  console.log(JSON.stringify({ totalCultures: rows.length, identicalNoCardPairs, comparisons, output }, null, 2));
} finally {
  await vite.close();
}
