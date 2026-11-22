import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lighthouse", () => ({ default: vi.fn() }));
vi.mock("chrome-launcher", () => ({ launch: vi.fn() }));

const source = readFileSync(join(process.cwd(), "scripts/audit-placard-mobile.mjs"), "utf8");
const playerShell = readFileSync(join(process.cwd(), "src/components/placard/PlacardPlayerShell.tsx"), "utf8");

describe("Placard mobile audit policy", () => {
  describe("target isolation", () => {
    const origin = "https://staging.example.test";
    const database = "https://database.example.test";
    const identity = {
      origin,
      version: "test-release",
      databaseHash: createHash("sha256").update(database).digest("hex"),
    };
    const fetchTarget = vi.fn<typeof fetch>();
    const runAudit = () => import("../../scripts/audit-placard-mobile.mjs");

    beforeEach(() => {
      vi.resetModules();
      vi.stubGlobal("fetch", fetchTarget.mockReset());
      vi.stubEnv("PLACARD_MOBILE_AUDIT_BASE_URL", origin);
      vi.stubEnv("PLACARD_MOBILE_REPORT_DIR", "output/placard-mobile-audits");
      vi.stubEnv("PLACARD_MOBILE_MIN_ACCOUNTS", "2");
      vi.stubEnv("PLACARD_MOBILE_AUDIT_COOKIES", "session=test-a||session=test-b");
      vi.stubEnv("PLACARD_MOBILE_AUDIT_COOKIE", "");
      vi.stubEnv("PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON", "");
      vi.stubEnv("PLACARD_TEST_APP_ORIGIN", origin);
      vi.stubEnv("PLACARD_TEST_DATABASE_ORIGIN", database);
      vi.stubEnv("PLACARD_TEST_VERSION", identity.version);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it.each([
      ["PLACARD_TEST_APP_ORIGIN", "https://other.example.test", "PLACARD_TEST_APP_ORIGIN"],
      ["PLACARD_TEST_DATABASE_ORIGIN", "", "PLACARD_TEST_DATABASE_ORIGIN"],
      ["PLACARD_TEST_VERSION", "", "PLACARD_TEST_VERSION"],
    ])("rejects %s=%s before making a request", async (name, value, message) => {
      vi.stubEnv(name, value);
      await expect(runAudit()).rejects.toThrow(message);
      expect(fetchTarget).not.toHaveBeenCalled();
    });

    it("requires HTTPS for a remote target", async () => {
      const insecureOrigin = "http://staging.example.test";
      vi.stubEnv("PLACARD_MOBILE_AUDIT_BASE_URL", insecureOrigin);
      vi.stubEnv("PLACARD_TEST_APP_ORIGIN", insecureOrigin);
      await expect(runAudit()).rejects.toThrow("HTTPS");
      expect(fetchTarget).not.toHaveBeenCalled();
    });

    it.each([
      ["origin", "https://other.example.test"],
      ["version", "other-release"],
      ["databaseHash", "other-database"],
    ])("stops before using accounts if the reported %s differs", async (field, value) => {
      fetchTarget.mockResolvedValue(Response.json({ ...identity, [field]: value }));
      await expect(runAudit()).rejects.toThrow("diffère de la cible de recette");
      expect(fetchTarget).toHaveBeenCalledExactlyOnceWith(`${origin}/api/arena/placard/test-target`, {
        redirect: "error", signal: expect.any(AbortSignal),
      });
    });

    it.each([origin, "http://127.0.0.1:3000"])("starts the age check after identifying %s", async (url) => {
      vi.stubEnv("PLACARD_MOBILE_AUDIT_BASE_URL", url);
      vi.stubEnv("PLACARD_TEST_APP_ORIGIN", url);
      fetchTarget.mockResolvedValueOnce(Response.json({ ...identity, origin: url }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }));
      await expect(runAudit()).rejects.toThrow("validation d’âge");
      expect(fetchTarget).toHaveBeenNthCalledWith(2, `${url}/api/age-gate/verify`, expect.objectContaining({ method: "POST" }));
      expect(fetchTarget).toHaveBeenCalledTimes(2);
    });
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
