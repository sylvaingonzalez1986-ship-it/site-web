import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/audit-placard-mobile.mjs"), "utf8");
const playerShell = readFileSync(join(process.cwd(), "src/components/placard/PlacardPlayerShell.tsx"), "utf8");

describe("Placard mobile audit policy", () => {
  it("cannot target a remote environment", () => {
    expect(source).toContain("if (!isLocal)");
    expect(source).not.toContain("ALLOW_REMOTE");
  });

  it("audits multiple authenticated accounts in a smartphone viewport", () => {
    expect(source).toContain("PLACARD_MOBILE_AUDIT_COOKIES");
    expect(source).toContain("PLACARD_MOBILE_AUDIT_COOKIE");
    expect(source).toContain("PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON");
    expect(source).toContain("PLACARD_MOBILE_MIN_ACCOUNTS");
    expect(source).toContain('width: 390');
    expect(source).toContain('height: 844');
    expect(source).toContain('formFactor: "mobile"');
  });

  it("can create local sessions without persisting or reporting credentials", () => {
    expect(source).toContain('fetch(`${baseUrl}/api/account/login`');
    expect(source).toContain("delete process.env.PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON");
    expect(source).toContain('authenticationMode = "credentials-json"');
    expect(source).not.toContain("profiles: preparedProfiles");
    expect(source).toContain("delete process.env.PLACARD_MOBILE_AUDIT_COOKIES");
    expect(source).toContain("delete process.env.PLACARD_MOBILE_AUDIT_COOKIE");
    expect(source).toContain("affectedNodes:");
    expect(source).not.toContain("item.node?.snippet");
  });

  it("archives a versioned report inside the workspace without overwriting evidence", () => {
    expect(source).toContain("PLACARD_MOBILE_REPORT_DIR");
    expect(source).toContain('schema: "kanab-quest-mobile-audit-v2"');
    expect(source).toContain("generatedAt,");
    expect(source).toContain("artifactPath,");
    expect(source).toContain("reportDirectoryFromRoot.startsWith(`..${sep}`)");
    expect(source).toContain("await mkdir(reportDirectory, { recursive: true })");
    expect(source).toContain('flag: "wx"');
  });

  it("rejects login redirects, unavailable bootstraps and identical collection profiles", () => {
    expect(source).toContain('fetch(`${baseUrl}/arene/placard`');
    expect(source).toContain('fetch(`${baseUrl}/api/arena/placard/bootstrap`');
    expect(source).toContain("pageResponse.status !== 200");
    expect(source).toContain("bootstrapResponse.status !== 200");
    expect(source).toContain('fetch(`${baseUrl}/api/arena/placard/equipment`');
    expect(source).toContain('fetch(`${baseUrl}/api/arena/placard/market`');
    expect(source).toContain("equipmentResponse.status !== 200");
    expect(source).toContain("marketResponse.status !== 200");
    expect(source).toContain("PLACARD_MOBILE_REQUIRE_DISTINCT_COLLECTIONS");
    expect(source).toContain("collectionProfileCount >= 2");
  });

  it("audits the HUD, the open equipment catalog and the market for every profile", () => {
    expect(source).toContain('{ code: "hud", path: "/arene/placard" }');
    expect(source).toContain('/arene/placard?view=shop&catalog=equipment');
    expect(source).toContain('/arene/placard?view=market');
    expect(source).toContain("for (const auditView of auditViews)");
    expect(source).toContain("auditedViews: auditViews.map");
    expect(source).toContain("viewCoverage:");
    expect(playerShell).toContain('params.get("view")');
    expect(playerShell).toContain('params.get("catalog") === "equipment"');
    expect(playerShell).toContain("data-placard-view={view}");
  });

  it("fails on core UX and payload budget regressions", () => {
    expect(source).toContain('"largest-contentful-paint"');
    expect(source).toContain('"cumulative-layout-shift"');
    expect(source).toContain('"total-byte-weight"');
    expect(source).toContain("if (!report.passed) process.exitCode = 1");
  });
});
