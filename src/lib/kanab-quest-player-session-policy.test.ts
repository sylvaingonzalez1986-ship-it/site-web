import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-backend.ts"),
  "utf8",
);

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findRouteFiles(path) : entry.name === "route.ts" ? [path] : [];
  });
}

const playerRouteRoot = join(process.cwd(), "src/app/api/arena/placard");
const playerRouteFiles = findRouteFiles(playerRouteRoot);
const schoolRouteRoot = join(playerRouteRoot, "school");
const schoolRequestPath = join(schoolRouteRoot, "_request.ts");
const schoolRequestSource = readFileSync(schoolRequestPath, "utf8");

function isSchoolRoute(route: string) {
  return route.startsWith(`${schoolRouteRoot}/`) || route.startsWith(`${schoolRouteRoot}\\`);
}

function playerPolicySource(route: string) {
  return isSchoolRoute(route) ? schoolRequestSource : readFileSync(route, "utf8");
}

describe("Kanab Quest player session ownership policy", () => {
  it("delegates every school handler to the shared guards and preserves retired-route rejections", () => {
    const schoolRoutes = playerRouteFiles.filter(isSchoolRoute);
    expect(schoolRoutes.length).toBeGreaterThan(0);
    for (const route of schoolRoutes) {
      const source = readFileSync(route, "utf8");
      const guard = source.includes("retiredSchoolQuizRequest") ? "retiredSchoolQuizRequest" : "schoolRequest";
      const guardFile = guard === "schoolRequest" ? "_request.ts" : "_retired-quiz.ts";
      const guardImport = source.match(new RegExp(`import\\s*\\{[^}]*\\b${guard}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`));
      expect(guardImport, route).not.toBeNull();
      expect(resolve(dirname(route), `${guardImport![1]}.ts`), route).toBe(join(schoolRouteRoot, guardFile));

      const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\(/g)];
      expect(handlers.length, route).toBeGreaterThan(0);
      for (const handler of handlers) {
        // Each HTTP method must enter the guard before parsing or running its operation.
        expect(source.slice(handler.index), `${route} ${handler[1]}`).toMatch(
          new RegExp(`^export async function ${handler[1]}\\([^)]*\\)\\s*\\{\\s*return ${guard}\\(request\\b`),
        );
      }
    }
    const retiredSource = readFileSync(join(schoolRouteRoot, "_retired-quiz.ts"), "utf8");
    expect(retiredSource).toContain('import { schoolRequest } from "./_request"');
    expect(retiredSource).toMatch(/export async function retiredSchoolQuizRequest\([^)]*\)\s*\{\s*const response = await schoolRequest\(request,/);
    expect(retiredSource).toContain("if (response.status !== 410) return response;");
  });

  it("checks access for the current request on every player endpoint", () => {
    expect(playerRouteFiles.length).toBeGreaterThanOrEqual(10);
    for (const route of playerRouteFiles) {
      const source = playerPolicySource(route);
      // Summary and staff use the same policy with the already verified identity,
      // avoiding profile creation. Their route tests cover rejection.
      const identityGateRoutes = ["summary", "staff"].map((segment) => join(playerRouteRoot, segment, "route.ts"));
      const gate = identityGateRoutes.includes(route)
        ? "!await isKqPlayerIdentityEnabled(session)"
        : "!await isKqPlayerRequestEnabled()";
      expect(source, route).toContain(gate);
    }
  });

  it("requires a customer session on every private endpoint", () => {
    for (const route of playerRouteFiles) {
      const relative = route.slice(playerRouteRoot.length).replaceAll("\\", "/");
      if (relative === "/rankings/route.ts") continue;
      expect(playerPolicySource(route), route).toContain("getCurrentCustomerSessionByBackend");
    }
  });

  it("uses the lightweight verified identity unless specific profile fields are required", () => {
    // These fields are absent from the verified identity. Keep the exceptions
    // explicit so a new player endpoint cannot silently load a full profile.
    const profileFieldsByRoute: Record<string, string[]> = {
      "/boosters/route.ts": ["session.customer.loyaltyPoints", "session.customer.loyaltyPointsSpent"],
      "/social/player/route.ts": ["firstName: session.customer.firstName"],
    };
    for (const route of playerRouteFiles) {
      const relative = route.slice(playerRouteRoot.length).replaceAll("\\", "/");
      if (relative === "/rankings/route.ts") continue;
      const source = playerPolicySource(route);
      const profileFields = profileFieldsByRoute[relative];
      if (profileFields) {
        expect(source, route).toContain("getCurrentCustomerSessionByBackend()");
        for (const field of profileFields) expect(source, route).toContain(field);
      } else {
        expect(source, route).toContain('getCurrentCustomerSessionByBackend("identity")');
        expect(source, route).not.toContain("getCurrentCustomerSessionByBackend()");
      }
    }
  });

  it("rate limits every player mutation after authentication", () => {
    const mutationRoutes = playerRouteFiles.filter((route) =>
      /export async function (POST|PUT|PATCH|DELETE)\(/.test(readFileSync(route, "utf8")));
    expect(mutationRoutes.length).toBeGreaterThanOrEqual(5);
    for (const route of mutationRoutes) {
      const source = playerPolicySource(route);
      const sessionIndex = source.indexOf("getCurrentCustomerSessionByBackend(");
      const rateLimitIndex = source.indexOf("hitRateLimit(");
      expect(sessionIndex, route).toBeGreaterThanOrEqual(0);
      expect(rateLimitIndex, route).toBeGreaterThan(sessionIndex);
      expect(source, route).toContain("Retry-After");
      expect(source, route).toContain("logRateLimitRejection");
    }
    const sessionRejectionIndex = schoolRequestSource.indexOf("if (!session) return");
    const rateLimitIndex = schoolRequestSource.indexOf("hitRateLimit(");
    const rateRejectionIndex = schoolRequestSource.indexOf("if (!rate.allowed)");
    const operationIndex = schoolRequestSource.indexOf("await operation(session.customerId)");
    expect(sessionRejectionIndex).toBeGreaterThan(schoolRequestSource.indexOf("getCurrentCustomerSessionByBackend("));
    expect(rateLimitIndex).toBeGreaterThan(sessionRejectionIndex);
    expect(rateRejectionIndex).toBeGreaterThan(rateLimitIndex);
    expect(operationIndex).toBeGreaterThan(rateRejectionIndex);
  });

  it("starts runs with the authenticated owner id and the atomic RPC", () => {
    const startSection = backend.slice(
      backend.indexOf("export async function startKqPlayerRun"),
      backend.indexOf("export async function startKqAdminRun"),
    );
    expect(startSection).toContain("p_user_id: ownerId");
    expect(startSection).toContain('intention ? "rpc_kq_start_zone_run" : "rpc_kq_start_run_with_heritage"');
    expect(startSection).not.toContain("adminEmail");
  });

  it("plays and burns cards with ownership and optimistic concurrency", () => {
    const cardSection = backend.slice(
      backend.indexOf("export async function playKqPlayerCard"),
      backend.indexOf("export async function playKqAdminCard"),
    );
    expect(cardSection).toContain('.eq("user_id", ownerId)');
    expect(cardSection).toContain('rpc("rpc_kq_play_support_card"');
    expect(cardSection).toContain("p_expected_updated_at");
    expect(cardSection).toContain("p_user_id: ownerId");
    expect(cardSection).not.toContain("adminEmail");
  });

  it("persists progression and final Flower creation for the owner atomically", () => {
    const actionSection = backend.slice(
      backend.indexOf("export async function applyKqPlayerRunAction"),
      backend.indexOf("export async function applyKqAdminRunAction"),
    );
    expect(actionSection).toContain('.eq("user_id", ownerId)');
    expect(actionSection).toContain("p_expected_updated_at");
    expect(actionSection).toContain("p_user_id: ownerId");
    expect(actionSection).toContain("p_flower: flower ?");
    expect(actionSection).toContain('rpc("rpc_kq_update_run_state"');
    expect(actionSection).not.toContain("adminEmail");
  });

  it("queues one owned Flower without accepting or exposing a chosen human rival", () => {
    const trainingSection = backend.slice(
      backend.indexOf("export async function getKqPlayerFlowerRivals"),
      backend.indexOf("export async function finalizeKqPlayerBotBattle"),
    );
    const queueSection = backend.slice(
      backend.indexOf("export async function enqueueKqPlayerRandomBattle"),
      backend.indexOf("export async function enqueueKqAdminRandomBattle"),
    );
    expect(trainingSection).toContain('.eq("owner_id", ownerId)');
    expect(trainingSection).not.toContain('from("kq_flowers:rivals")');
    expect(trainingSection).not.toContain("recentOpponentIds");
    expect(queueSection).toContain('rpc("rpc_kq_enqueue_random_battle"');
    expect(queueSection).toContain("p_player_id: ownerId");
    expect(queueSection).toContain("p_flower_id: flowerId");
    expect(queueSection).toContain('rpc("rpc_kq_leave_random_battle_queue"');
    expect(queueSection).not.toContain("rivalFlowerId");
  });

  it("finalizes both Flowers, rankings and challenge claims from a participating player", () => {
    const verdictSection = backend.slice(
      backend.indexOf("export async function finalizeKqPlayerBattle"),
      backend.indexOf("export async function finalizeKqAdminBattle"),
    );
    expect(verdictSection).toContain("getKqPlayerBattle(ownerId, battleId)");
    expect(verdictSection).toContain('rpc("rpc_kq_finalize_battle_for_both_players"');
    expect(verdictSection).toContain("p_user_id: ownerId");
    expect(verdictSection).toContain("p_opponent_challenge_codes");
    expect(verdictSection).toContain("return finalizeKqPlayerBattle(ownerId, battleId)");
    expect(verdictSection).not.toContain("adminEmail");
  });

  it("filters physical card copies and the token wallet by owner", () => {
    const collectionSection = backend.slice(
      backend.indexOf("export async function getKqPlayerCollectionSnapshot"),
      backend.indexOf("export async function getKqAdminCollectionSnapshot"),
    );
    expect(collectionSection).toContain('.eq("user_id", ownerId)');
    expect(collectionSection).toContain('rpc("rpc_kq_card_copy_counts"');
    expect(collectionSection).toContain("p_user_id: ownerId");
    expect(collectionSection).not.toContain("adminEmail");
    expect(collectionSection).not.toContain("listUsers");
  });

  it("filters runs and flowers by the authenticated owner", () => {
    const runSection = backend.slice(
      backend.indexOf("async function readKqPlayerRuns"),
      backend.indexOf("export async function getKqAdminActiveRun"),
    );
    const flowerSection = backend.slice(
      backend.indexOf("export async function getKqPlayerFlowers"),
      backend.indexOf("export async function getKqAdminFlowers"),
    );
    expect(runSection).toContain('.eq("user_id", ownerId)');
    expect(flowerSection).toContain('.eq("owner_id", ownerId)');
    expect(flowerSection).toContain('.in("status", ["available", "locked"])');
    expect(flowerSection).toContain(".limit(40)");
  });

  it("limits battle reads to matches involving the authenticated owner", () => {
    const battleSection = backend.slice(
      backend.indexOf("export async function getKqPlayerBattles"),
      backend.indexOf("export async function getKqAdminBattles"),
    );
    expect(battleSection).toContain("player_one_id.eq.${ownerId}");
    expect(battleSection).toContain("player_two_id.eq.${ownerId}");
    expect(battleSection).not.toContain("adminEmail");
    expect(battleSection).toContain(".limit(limit)");
    expect(battleSection).toContain('.eq("id", battleId)');
    expect(battleSection).toContain(".maybeSingle()");
  });

  it("reads a saved leaderboard while calculating the player's score from current reputation", () => {
    const progressSection = backend.slice(
      backend.indexOf("export async function getKqPlayerProgress"),
      backend.indexOf("export function prepareKqCardPlay"),
    );
    expect(progressSection).not.toContain("getKqPublicLeaderboard()");
    expect(progressSection).not.toContain("rpc_kq_refresh_daily_leaderboard");
    expect(progressSection).toContain('from("kq_leaderboard_snapshots")');
    expect(progressSection).toContain("calculateKqPlacardScore({");
    expect(progressSection).toContain('select("reputation")');
  });
});
