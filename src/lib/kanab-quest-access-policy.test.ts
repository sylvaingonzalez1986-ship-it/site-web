import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isAdminRestrictedPage } from "../../middleware";

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findRouteFiles(path) : entry.name === "route.ts" ? [path] : [];
  });
}

const adminPlacardApiDirectory = join(process.cwd(), "src/app/api/admin/placard");
const adminPlacardRoutes = findRouteFiles(adminPlacardApiDirectory);
const adminPage = readFileSync(join(process.cwd(), "src/app/admin/placard/page.tsx"), "utf8");
const legacyPage = readFileSync(join(process.cwd(), "src/app/dev/placard/page.tsx"), "utf8");
const arenaClient = readFileSync(join(process.cwd(), "src/components/contest/ContestHubClient.tsx"), "utf8");
const adminArenaPanel = readFileSync(join(process.cwd(), "src/components/admin/AdminContestPanel.tsx"), "utf8");
const placardOperations = readFileSync(join(process.cwd(), "src/components/admin/AdminPlacardOperationsPanel.tsx"), "utf8");

describe("Kanab Quest admin-only test access", () => {
  it("guards every Placard API route with a validated admin context", () => {
    expect(adminPlacardRoutes.length).toBeGreaterThan(10);
    for (const route of adminPlacardRoutes) {
      expect(readFileSync(route, "utf8"), route).toContain("getValidatedAdminContext");
    }
  });

  it("protects both direct page entry points even if one guard layer changes", () => {
    expect(isAdminRestrictedPage("/admin/placard")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard")).toBe(true);
    expect(adminPage).toContain("isCurrentRequestAdminAuthorized");
    expect(adminPage).toContain('redirect("/admin/login?next=%2Fadmin%2Fplacard")');
    expect(legacyPage).toContain('redirect("/admin/placard")');
  });

  it("keeps the admin launch links as the fallback while player access is closed", () => {
    expect(arenaClient.match(/href="\/admin\/placard"/g)).toHaveLength(1);
    expect(arenaClient).toContain("isPlacardPlayerEnabled && isAuthenticated");
    expect(arenaClient).toContain(": isAdminAuthorized ? (");
  });

  it("mounts the playable prototype only from the protected admin page", () => {
    const appSources = [
      adminPage,
      legacyPage,
      arenaClient,
    ];
    expect(appSources.filter((source) => source.includes("<KanabQuestDicePrototype"))).toHaveLength(1);
    expect(adminPage).toContain("<KanabQuestDicePrototype");
  });

  it("centralizes Placard operations in the Arena admin and keeps the game clean", () => {
    expect(adminArenaPanel).toContain("<AdminPlacardOperationsPanel");
    expect(adminArenaPanel).toContain("placardOpen ? <AdminPlacardOperationsPanel");
    expect(adminArenaPanel).toContain('aria-expanded={placardOpen}');
    expect(adminPage).toContain("showAdminOperations={false}");
    expect(placardOperations).toContain('"/api/admin/placard/bootstrap"');
    expect(placardOperations).toContain('"/api/admin/placard/notebook-rewards"');
    expect(placardOperations).toContain('"/api/admin/placard/heritage/retro"');
    expect(placardOperations).toContain('"/api/admin/placard/season-rewards"');
  });
});
