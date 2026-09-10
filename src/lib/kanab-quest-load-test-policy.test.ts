import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/load-test-placard.mjs"),
  "utf8",
);

describe("Placard load-test policy", () => {
  it("requires three exact safeguards for a remote staging target", () => {
    expect(source).toContain('PLACARD_LOAD_TEST_ALLOW_REMOTE === "1"');
    expect(source).toContain('PLACARD_LOAD_TEST_CONFIRM_TARGET === "STAGING_READ_ONLY"');
    expect(source).toContain("PLACARD_LOAD_TEST_ALLOWED_HOST");
    expect(source).toContain("targetHost !== allowedRemoteHost");
  });

  it("requires multiple distinct authenticated accounts by default", () => {
    expect(source).toContain("PLACARD_LOAD_TEST_COOKIES");
    expect(source).toContain("PLACARD_LOAD_TEST_MIN_ACCOUNTS || 2");
    expect(source).toContain("const uniqueCookies = [...new Set(cookies)]");
    expect(source).toContain("uniqueCookies.length < minimumAccounts");
    expect(source).toContain("delete process.env.PLACARD_LOAD_TEST_COOKIES");
    expect(source).toContain("delete process.env.PLACARD_LOAD_TEST_COOKIE");
  });

  it("archives a versioned report inside the workspace without overwriting evidence", () => {
    expect(source).toContain("PLACARD_LOAD_TEST_REPORT_DIR");
    expect(source).toContain('schema: "kanab-quest-load-test-v2"');
    expect(source).toContain("generatedAt,");
    expect(source).toContain("artifactPath,");
    expect(source).toContain("reportDirectoryFromRoot.startsWith(`..${sep}`)");
    expect(source).toContain("await mkdir(reportDirectory, { recursive: true })");
    expect(source).toContain('flag: "wx"');
    expect(source).toContain("passed,");
  });

  it("preflights every account before creating load jobs", () => {
    const preflightIndex = source.indexOf("const accountPreflights = await Promise.all");
    const jobsIndex = source.indexOf("const jobs = Array.from");
    expect(preflightIndex).toBeGreaterThan(0);
    expect(jobsIndex).toBeGreaterThan(preflightIndex);
    expect(source).toContain("pageResponse.status !== 200 || bootstrapResponse.status !== 200");
  });

  it("only exercises the intended read-only page and API routes", () => {
    expect(source).toContain('"/arene/placard"');
    expect(source).toContain('"/api/arena/placard/bootstrap"');
    expect(source).toContain('"/api/arena/placard/rankings"');
    expect(source).toContain('"/api/arena/placard/flowers"');
    expect(source).toContain('"/api/arena/placard/battles"');
    expect(source).toContain('"/api/arena/placard/equipment"');
    expect(source).toContain('"/api/arena/placard/market"');
    expect(source).not.toContain('method: "POST"');
  });

  it("simulates the expected hundred-player launch load by default", () => {
    expect(source).toContain("PLACARD_LOAD_TEST_PARTICIPANTS || 100");
  });

  it("keeps distinct page, API and error-rate budgets", () => {
    expect(source).toContain("PLACARD_LOAD_TEST_PAGE_P95_MS");
    expect(source).toContain("PLACARD_LOAD_TEST_API_P95_MS");
    expect(source).toContain("PLACARD_LOAD_TEST_MAX_ERROR_RATE");
    expect(source).toContain("withinBudget");
  });
});
