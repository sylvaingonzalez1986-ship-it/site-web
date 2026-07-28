import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/audit-placard-mobile.mjs"), "utf8");

describe("Placard mobile audit policy", () => {
  it("cannot target a remote environment", () => {
    expect(source).toContain("if (!isLocal)");
    expect(source).not.toContain("ALLOW_REMOTE");
  });

  it("audits an authenticated smartphone viewport", () => {
    expect(source).toContain("PLACARD_MOBILE_AUDIT_COOKIE");
    expect(source).toContain('width: 390');
    expect(source).toContain('height: 844');
    expect(source).toContain('formFactor: "mobile"');
  });

  it("fails on core UX and payload budget regressions", () => {
    expect(source).toContain('"largest-contentful-paint"');
    expect(source).toContain('"cumulative-layout-shift"');
    expect(source).toContain('"total-byte-weight"');
    expect(source).toContain("if (!summary.passed) process.exitCode = 1");
  });
});
