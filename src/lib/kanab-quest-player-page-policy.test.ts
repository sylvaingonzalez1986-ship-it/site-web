import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isKqLocalPlayerPreviewEnabled,
  isKqPlayerApiEnabled,
  isKqPublicPlayerApiEnabled,
} from "./kanab-quest-player-access";
import { KQ_LAUNCH_APPROVAL_ENV_KEYS } from "./kanab-quest-launch-approvals";

const VALID_DOSSIER_JSON = JSON.stringify({
  seasonCode: "KQ-2026-S1",
  startsAt: "2026-10-01T10:00:00+02:00",
  endsAt: "2026-11-01T18:00:00+01:00",
  timezone: "Europe/Paris",
  territory: "France métropolitaine",
  minimumAge: 18,
  eligibility: "Résidence principale en France métropolitaine.",
  prizes: [
    { tierCode: "champion", label: "Champion", quantity: 1, stock: 1, unitValueCents: 10_000, fulfillment: "Envoi suivi" },
    { tierCode: "podium", label: "Podium", quantity: 3, stock: 3, unitValueCents: 5_000, fulfillment: "Envoi suivi" },
    { tierCode: "finalist", label: "Finaliste", quantity: 10, stock: 10, unitValueCents: 1_000, fulfillment: "Envoi suivi" },
    { tierCode: "participant", label: "Participant", quantity: 100, stock: 100, unitValueCents: 0, fulfillment: "Attribution numérique" },
  ],
  oddsVersion: "botte-70-24-6__heritage-equal-v1",
  publicRulesUrl: "https://leschanvriersbretons.com/reglement-jeu-promo",
  contactEmail: "jeu@leschanvriersbretons.com",
});

const playerPage = readFileSync(join(process.cwd(), "src/app/arene/placard/page.tsx"), "utf8");
const playerShell = readFileSync(
  join(process.cwd(), "src/components/placard/PlacardPlayerShell.tsx"),
  "utf8",
);
const placardHud = readFileSync(
  join(process.cwd(), "src/components/placard/KqPlacardHud.tsx"),
  "utf8",
);
const boosterShop = readFileSync(
  join(process.cwd(), "src/components/placard/KqSupportBoosterShop.tsx"),
  "utf8",
);
const equipmentCatalog = readFileSync(
  join(process.cwd(), "src/components/placard/KqEquipmentCatalogModal.tsx"),
  "utf8",
);
const marketDesk = readFileSync(
  join(process.cwd(), "src/components/placard/KqMarketDesk.tsx"),
  "utf8",
);
const gameClient = readFileSync(
  join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.tsx"),
  "utf8",
);
const gameBackend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-backend.ts"),
  "utf8",
);
const arenaClient = readFileSync(
  join(process.cwd(), "src/components/contest/ContestHubClient.tsx"),
  "utf8",
);

describe("Kanab Quest player page access", () => {
  const originalFlag = process.env.KQ_PLAYER_API_LIVE;
  const originalPreviewFlag = process.env.KQ_LOCAL_PLAYER_PREVIEW;
  const originalDossier = process.env.KQ_LAUNCH_DOSSIER_JSON;
  const originalApprovalFlags = Object.fromEntries(
    KQ_LAUNCH_APPROVAL_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = originalFlag;
    if (originalPreviewFlag === undefined) delete process.env.KQ_LOCAL_PLAYER_PREVIEW;
    else process.env.KQ_LOCAL_PLAYER_PREVIEW = originalPreviewFlag;
    vi.unstubAllEnvs();
    if (originalDossier === undefined) delete process.env.KQ_LAUNCH_DOSSIER_JSON;
    else process.env.KQ_LAUNCH_DOSSIER_JSON = originalDossier;
    KQ_LAUNCH_APPROVAL_ENV_KEYS.forEach((key) => {
      const original = originalApprovalFlags[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    });
  });

  it("stays closed until player access and every launch decision are explicitly enabled", () => {
    delete process.env.KQ_LOCAL_PLAYER_PREVIEW;
    delete process.env.KQ_PLAYER_API_LIVE;
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PLAYER_API_LIVE = " TRUE ";
    KQ_LAUNCH_APPROVAL_ENV_KEYS.forEach((key) => { process.env[key] = "true"; });
    delete process.env.KQ_LAUNCH_DOSSIER_JSON;
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_LAUNCH_DOSSIER_JSON = VALID_DOSSIER_JSON;
    process.env.KQ_PUBLIC_RULES_APPROVED = "false";
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PUBLIC_RULES_APPROVED = " TRUE ";
    expect(isKqPlayerApiEnabled()).toBe(true);
    process.env.KQ_COLLECTION_ODDS_APPROVED = "false";
    expect(isKqPlayerApiEnabled()).toBe(false);
  });

  it("opens an explicit local preview only in development without faking public readiness", () => {
    process.env.KQ_LOCAL_PLAYER_PREVIEW = "true";
    process.env.KQ_PLAYER_API_LIVE = "false";
    vi.stubEnv("NODE_ENV", "development");
    expect(isKqLocalPlayerPreviewEnabled()).toBe(true);
    expect(isKqPublicPlayerApiEnabled()).toBe(false);
    expect(isKqPlayerApiEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(isKqLocalPlayerPreviewEnabled()).toBe(false);
    expect(isKqPlayerApiEnabled()).toBe(false);
  });

  it("checks the server flag before requiring a customer session", () => {
    const flagGuard = playerPage.indexOf("if (!isKqPlayerApiEnabled()) notFound()");
    const sessionLookup = playerPage.indexOf("getCurrentCustomerSessionByBackend(");
    expect(flagGuard).toBeGreaterThan(-1);
    expect(sessionLookup).toBeGreaterThan(flagGuard);
    expect(playerPage).toContain('getCurrentCustomerSessionByBackend("identity")');
    expect(playerPage).toContain('redirect("/compte/connexion?next=%2Farene%2Fplacard")');
  });

  it("mounts the customer-scoped game without duplicate overview requests", () => {
    expect(playerShell).not.toContain("fetch(");
    expect(playerShell).not.toContain("/api/admin/placard");
    expect(playerShell).toMatch(/<KanabQuestDicePrototype\s+apiScope="player"/);
    expect(gameClient).toContain('"/api/arena/placard/bootstrap"');
    expect(gameClient).toContain('"/api/arena/placard/session"');
    expect(playerShell).toContain('loading={destination.id === "shop" ? "eager" : "lazy"}');
  });

  it("opens the recommended investment directly without forcing it into the cart", () => {
    expect(placardHud).toContain("onOpenShop(nextGoal.equipment.code)");
    expect(playerShell).toContain("initialEquipmentCode={requestedEquipmentCode}");
    expect(boosterShop).toContain("initialEquipmentCode={initialEquipmentCode}");
    expect(equipmentCatalog).toContain("useState<string | null>(recommendedEquipmentCode)");
    expect(equipmentCatalog).toContain("data-recommended={equipment.code === recommendedEquipmentCode || undefined}");
    expect(equipmentCatalog).toContain("Objectif conseillé");
    expect(equipmentCatalog).toContain("const [cartCodes, setCartCodes] = useState<string[]>([])");
    expect(equipmentCatalog).toContain("Acheté ne veut pas dire installé");
    expect(equipmentCatalog).toContain("getKqEquipmentImpactLabels(equipment)");
    expect(equipmentCatalog).toContain("KQ_EQUIPMENT_UNLOCK_LABELS[strongestUnlock]");
    expect(equipmentCatalog).toContain('aria-label="Impact du panier après installation"');
    expect(equipmentCatalog).toContain('aria-label="Bénéfices projetés après installation"');
    expect(equipmentCatalog).toContain("newlyUnlockedLabels");
    expect(equipmentCatalog).toContain("Ce que cet investissement change");
    expect(equipmentCatalog).toContain("getKqNewlyUnlockedMarketRoutes");
    expect(equipmentCatalog).toContain("Filières réellement ouvertes");
    expect(equipmentCatalog).toContain("route.minimumJuryScore.toFixed(1)");
    expect(equipmentCatalog).toContain('aria-label="Projection personnalisée dans ton atelier"');
    expect(equipmentCatalog).toContain("selectedInstalledEquipment.name");
    expect(equipmentCatalog).toContain("Filières complétées");
    expect(equipmentCatalog).toContain("getLoadoutProjectionMetrics(currentLoadout, selectedProjection)");
    expect(equipmentCatalog).toContain('aria-label="Amortissement indicatif de la machine"');
    expect(equipmentCatalog).toContain("getKqEquipmentPaybackScenarios");
    expect(equipmentCatalog).toContain("Surplus par lot");
    expect(equipmentCatalog).toContain("Capital restant");
    expect(equipmentCatalog).toContain("Encore à ajouter");
    expect(equipmentCatalog).toContain("Chaîne à compléter");
    expect(equipmentCatalog).toContain("personalizedPaybackHarvests");
    expect(equipmentCatalog).toContain("getKqEquipmentInvestmentProgress");
    expect(equipmentCatalog).toContain("Objectif d’épargne");
    expect(equipmentCatalog).toContain("Préparer la chaîne");
    expect(equipmentCatalog).toContain("addEquipmentChainToCart");
    expect(equipmentCatalog).toContain('aria-label="Objectif de filière du panier"');
    expect(equipmentCatalog).toContain("plannedRouteScenario.minimumJuryScore");
    expect(equipmentCatalog).toContain("plannedRouteScenario.comparisonDeltaCents");
    expect(equipmentCatalog).toContain("Compléter le panier");
    expect(equipmentCatalog).toContain("Chaîne complète dans le panier et l’atelier");
    expect(equipmentCatalog).toContain("À installer pour activer ces avantages");
    expect(equipmentCatalog).toContain("Bonus actifs dans l’atelier");
    expect(equipmentCatalog).toContain("snapshot?.equippedCodes.includes(code)");
    expect(equipmentCatalog).toContain("onClick={() => void equip(code)}");
    expect(equipmentCatalog).toContain("Prérequis manquant");
    expect(equipmentCatalog).toContain("Modèle alternatif");
    expect(equipmentCatalog).toContain('role="dialog" aria-modal="true" aria-labelledby="equipment-purchase-title"');
    expect(marketDesk).toContain("onOpenShop(saleReceipt.nextEquipmentGoal?.code)");
    expect(marketDesk).toContain("getKqMarketEquipmentGoal");
    expect(marketDesk).toContain("Objectif prochaine récolte");
    expect(marketDesk).toContain("onOpenShop(equipmentGoal.code)");
    expect(marketDesk).toContain("buildKqEquipmentGoalReceipt");
    expect(marketDesk).toContain('aria-label="Progression après cette vente"');
    expect(marketDesk).toContain("Objectif débloqué par cette vente");
    expect(marketDesk).toContain("pendingSalePreview.reputationProgress.tier.name");
    expect(marketDesk).toContain("getKqEquipmentSaleFundingProjection");
    expect(marketDesk).toContain("Filière débloquée par cette vente");
    expect(marketDesk).toContain("vente${pendingSalePreview.routeFunding.projection.comparableSalesRemaining");
    expect(marketDesk).toContain("Progression de la filière épinglée");
    expect(marketDesk).toContain("receiptRouteFunding.equipmentCode");
    expect(marketDesk).toContain("Nouvelle filière maîtrisée");
    expect(marketDesk).toContain("Première vente homologuée sur cette voie");
    expect(marketDesk).toContain("Prochain palier");
    expect(marketDesk).toContain("adoptNextRouteGoal");
    expect(marketDesk).toContain("payload.routeMastery?.matchedPlan");
    expect(marketDesk).toContain("getKqPinnedRouteLotStatus");
    expect(marketDesk).toContain("prioritizeKqPinnedMarketRoute");
    expect(marketDesk).toContain("displayedOptions.map");
    expect(marketDesk).toContain("getPinnedRouteStatusLabel");
    expect(marketDesk).toContain("Filière épinglée");
    expect(marketDesk).toContain("Ce lot est prêt");
    expect(marketDesk).toContain("Chaîne à compléter");
    expect(marketDesk).toContain("data-pinned={pinnedRoute || undefined}");
    expect(marketDesk).toContain("data-mastered={routeMastery ? true : undefined}");
    expect(marketDesk).toContain("Record personnel");
    expect(marketDesk).toContain("Nouveau rang de filière");
    expect(marketDesk).toContain("receiptRouteExpertise.salesToNext");
    expect(marketDesk).toContain("getKqRouteExpertiseBonusReputation");
    expect(marketDesk).toContain("Prime de palier sur cette vente");
    expect(marketDesk).toContain("pendingSalePreview?.reputationGain");
    expect(marketDesk).toContain("data-mission={missionRoute || undefined}");
    expect(marketDesk).toContain("Mission d’atelier");
    expect(marketDesk).toContain("onOpenShop(pinnedEquipmentCode)");
    expect(marketDesk).toContain("createClientRequestKey()");
    expect(marketDesk).toContain("saleRequestKeyRef.current");
    expect(marketDesk).toContain('className={styles.modalError} role="alert"');
    expect(marketDesk).not.toContain("crypto.randomUUID()");
    expect(equipmentCatalog).toContain("createClientRequestKey()");
    expect(boosterShop).toContain("createClientRequestKey()");
    expect(playerShell).toContain("<KqMarketDesk onOpenShop={openEquipmentCatalog} />");
    expect(playerShell).toContain("openView(shopReturnView)");
    expect(placardHud).toContain("Progression principale terminée");
    expect(placardHud).toContain("Filière épinglée · objectif sauvegardé");
    expect(placardHud).toContain("getKqEquipmentPaybackScenarios");
    expect(placardHud).toContain("routeGoalScenario.minimumJuryScore");
    expect(placardHud).toContain("Poursuivre la filière");
    expect(placardHud).toContain('aria-label="Filières maîtrisées"');
    expect(placardHud).toContain("Palmarès permanent");
    expect(placardHud).toContain("mastery.expertise.tier.name");
    expect(placardHud).toContain('aria-label="Mission d’atelier"');
    expect(placardHud).toContain("expertiseMission.bonusReputation");
    expect(placardHud).toContain("getKqRoutePlanEquipmentGoal");
    expect(placardHud).toContain("Épingler et équiper");
    expect(placardHud).toContain("pinExpertiseMission");
    expect(equipmentCatalog).toContain("Projet d’atelier sauvegardé");
    expect(equipmentCatalog).toContain('action: "route-plan"');
  });

  it("exposes the complete production loop from the Placard HUD", () => {
    expect(placardHud).toContain('aria-label="Cycle de production"');
    expect(placardHud).toContain("Étape 1 · Culture");
    expect(placardHud).toContain("Étape 2 · Jury");
    expect(placardHud).toContain("Étape 3 · Vente");
    expect(placardHud).toContain("snapshot?.availableFlowerCount");
    expect(placardHud).toContain("snapshot?.readyLotCount");
    expect(placardHud).toContain("onClick={onOpenMarket}");
  });

  it("compares the four culture systems and reserves the free start for potting soil", () => {
    expect(gameClient).toContain("Ton mode de culture");
    expect(gameClient).toContain("cultureSystemTechnique");
    expect(gameClient).toContain("Pilotage");
    expect(gameClient).toContain("Électricité");
    expect(gameClient).toContain('card.code !== "BOTTE-001"');
    expect(gameClient).toContain('const cultureSystemCode = usesFreeSubstrate ? "BOTTE-001" : selectedSubstrate');
    expect(gameClient).not.toContain("ton substrat et tes cartes");
    expect(gameBackend).toContain('selectedCultureSystem?.code !== "BOTTE-001"');
    expect(gameBackend).toContain("Le mode de culture gratuit est le Terreau horticole.");
    expect(marketDesk).toContain("Trace de culture");
    expect(marketDesk).toContain("Aucun bonus caché");
    expect(gameClient).toContain("flower.traits.map");
    expect(gameClient).toContain("getKqCultureSystemSituationStatus(state)");
    expect(gameClient).toContain("cultureSystemStatus.label");
    expect(gameClient).toContain('aria-label="Projection de la récolte"');
    expect(gameClient).toContain("Projection non garantie");
    expect(gameClient).toContain("getKqRunProjection(state)");
    expect(gameClient).toContain("getKqPinnedRouteFlowerPreview");
    expect(gameClient).toContain("Cap commercial épinglé");
    expect(gameClient).toContain("estimation pré-jury");
    expect(gameClient).toContain("seul le verdict officiel donnera la note commerciale");
    expect(gameClient).toContain('window.addEventListener("kq:equipment-updated", refreshRoutePlan)');
    expect(gameClient).toContain("getKqPinnedRouteVerdictStatus");
    expect(gameClient).toContain('aria-label="Résultat commercial du jury"');
    expect(gameClient).toContain("Note commerciale officielle");
    expect(gameClient).toContain("Valoriser ce lot");
    expect(playerShell).toContain('onOpenMarket={() => openView("market")}');
    expect(gameClient).toContain('aria-label="Gains de l’étape"');
    expect(gameClient).toContain("Lot projeté");
    expect(gameClient).toContain('aria-label="Bulletin de la récolte"');
    expect(gameClient).toContain("Pourquoi cette note ?");
    expect(gameClient).not.toContain("Math.max(0, state.quality)");
  });

  it("forces real server mode and hides prototype controls from players", () => {
    expect(gameClient).toContain('const isPlayerMode = apiScope === "player"');
    expect(gameClient).toContain("useState(isPlayerMode)");
    expect(gameClient).toContain("if (isPlayerMode) return");
    expect(gameClient).toContain("!isPlayerMode ? <button");
    expect(gameClient).toContain("!isPlayerMode && (showAdminOperations || showPackLab) ? <details");
  });

  it("routes an official harvest back to the server-backed reserve", () => {
    const playerHarvestBranch = gameClient.indexOf("if (isPlayerMode) {", gameClient.indexOf('state.phase === "complete"'));
    const localBattleEntry = gameClient.indexOf("Battle Fleur contre Fleur", playerHarvestBranch);
    expect(playerHarvestBranch).toBeGreaterThan(-1);
    expect(gameClient.slice(playerHarvestBranch, localBattleEntry)).toContain(
      "Voir ma réserve et entrer dans la file",
    );
    expect(gameClient.slice(playerHarvestBranch, localBattleEntry)).toContain(
      "Elle n’est pas brûlée maintenant",
    );
    expect(gameClient.slice(playerHarvestBranch, localBattleEntry)).toContain(
      "onClick={onOpenArena ?? reset}",
    );
    expect(playerShell).toContain('onOpenArena={() => openView("arena")}');
  });

  it("never asks the player to choose a human or training opponent", () => {
    expect(placardHud).toContain("adversaire tiré au hasard");
    expect(gameClient).toContain("Entraînement aléatoire");
    expect(gameClient).toContain("bot tiré au hasard");
    expect(gameClient).not.toContain("choisir un rival");
    expect(gameClient).not.toContain("Affronter ce bot");
    expect(gameClient).not.toContain("selectedRemoteRivalId");
  });

  it("presents Heritage producer cards after the collection chest", () => {
    const chest = gameClient.indexOf('className={styles.collectionChest}');
    const heritageCarousel = gameClient.indexOf('className={styles.heritageCarouselSection}');
    expect(chest).toBeGreaterThan(-1);
    expect(heritageCarousel).toBeGreaterThan(chest);
    expect(gameClient).toContain("4. Producteurs mis à l’honneur");
    expect(gameClient).toContain("4 cartes à la fois");
    expect(gameClient).toContain("heritageCarouselRef.current?.scrollBy");
  });

  it("cannot locally reset an active official culture", () => {
    expect(gameClient).toContain('if (isPlayerMode && remoteRunId && state.phase !== "complete")');
    expect(gameClient).toContain("Ta culture officielle est toujours active");
    expect(gameClient).toContain("{!isPlayerMode ? <button type=\"button\" onClick={reset}");
  });

  it("never restores or persists official game state through localStorage", () => {
    expect(gameClient).toContain("if (!isPlayerMode && snapshot.game)");
    expect(gameClient).toContain("if (hydrated && !isPlayerMode)");
    expect(gameClient).toContain("if (!hydrated || isPlayerMode) return");
    expect(gameClient).toContain("if (isPlayerMode) {\n            setState(startKqGame(Date.now()))");
  });

  it("shows player links only from the server-provided access state", () => {
    expect(arenaClient.match(/href="\/arene\/placard"/g)).toHaveLength(2);
    expect(arenaClient).toContain(
      'isPlacardPlayerEnabled={isPlacardPlayerEnabled}',
    );
    expect(arenaClient).toContain("isPlacardPlayerEnabled && isAuthenticated");
    expect(arenaClient).toContain("isPlacardPlayerEnabled ? (");
  });
});
