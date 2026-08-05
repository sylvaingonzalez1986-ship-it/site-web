import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isKqPlayerApiEnabled } from "./kanab-quest-player-access";

const playerPage = readFileSync(join(process.cwd(), "src/app/arene/placard/page.tsx"), "utf8");
const playerShell = readFileSync(
  join(process.cwd(), "src/components/placard/PlacardPlayerShell.tsx"),
  "utf8",
);
const gameClient = readFileSync(
  join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.tsx"),
  "utf8",
);
const arenaClient = readFileSync(
  join(process.cwd(), "src/components/contest/ContestHubClient.tsx"),
  "utf8",
);

describe("Kanab Quest player page access", () => {
  const originalFlag = process.env.KQ_PLAYER_API_LIVE;
  const originalRulesFlag = process.env.KQ_PUBLIC_RULES_APPROVED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = originalFlag;
    if (originalRulesFlag === undefined) delete process.env.KQ_PUBLIC_RULES_APPROVED;
    else process.env.KQ_PUBLIC_RULES_APPROVED = originalRulesFlag;
  });

  it("stays closed until both player access and public rules are explicitly enabled", () => {
    delete process.env.KQ_PLAYER_API_LIVE;
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PLAYER_API_LIVE = " TRUE ";
    process.env.KQ_PUBLIC_RULES_APPROVED = "false";
    expect(isKqPlayerApiEnabled()).toBe(false);
    process.env.KQ_PUBLIC_RULES_APPROVED = " TRUE ";
    expect(isKqPlayerApiEnabled()).toBe(true);
  });

  it("checks the server flag before requiring a customer session", () => {
    const flagGuard = playerPage.indexOf("if (!isKqPlayerApiEnabled()) notFound()");
    const sessionLookup = playerPage.indexOf("getCurrentCustomerSessionByBackend()");
    expect(flagGuard).toBeGreaterThan(-1);
    expect(sessionLookup).toBeGreaterThan(flagGuard);
    expect(playerPage).toContain('redirect("/compte/connexion?next=%2Farene%2Fplacard")');
  });

  it("mounts the customer-scoped game without duplicate overview requests", () => {
    expect(playerShell).not.toContain("fetch(");
    expect(playerShell).not.toContain("/api/admin/placard");
    expect(playerShell).toContain('<KanabQuestDicePrototype apiScope="player"');
    expect(gameClient).toContain('"/api/arena/placard/bootstrap"');
    expect(gameClient).toContain('"/api/arena/placard/session"');
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
      "Voir ma réserve et choisir un rival",
    );
    expect(gameClient.slice(playerHarvestBranch, localBattleEntry)).toContain(
      "Elle n’est pas brûlée maintenant",
    );
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
    expect(arenaClient).toContain("isPlacardPlayerEnabled && isAuthenticated");
    expect(arenaClient).toContain("isPlacardPlayerEnabled ? (");
  });
});
