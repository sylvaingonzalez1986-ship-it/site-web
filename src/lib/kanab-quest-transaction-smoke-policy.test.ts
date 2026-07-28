import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/smoke-test-placard-transactions.mjs"),
  "utf8",
);

describe("Placard transaction smoke-test policy", () => {
  it("only accepts localhost targets without a remote override", () => {
    expect(source).toContain("const isLocal = /^https?:");
    expect(source).toContain("if (!isLocal)");
    expect(source).not.toContain("ALLOW_REMOTE");
  });

  it("requires an explicit destructive-action confirmation", () => {
    expect(source).toContain('PLACARD_SMOKE_CONFIRM_BURNS === "LOCAL_BURNS_ONLY"');
    expect(source).toContain("if (!confirmation)");
  });

  it("only exposes the two intended burn scenarios", () => {
    expect(source).toContain('if (![\"card\", \"verdict\"].includes(action))');
    expect(source).toContain("/cards");
    expect(source).toContain("/verdict");
  });
});
