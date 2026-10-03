import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "eslint";
import { configs as nextConfigs } from "@next/eslint-plugin-next";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../../", import.meta.url));
const requireFromTest = createRequire(import.meta.url);
const { getRootDirs } = requireFromTest(
  "@next/eslint-plugin-next/dist/utils/get-root-dirs.js",
) as {
  getRootDirs: (context: {
    cwd: string;
    settings: Record<string, unknown>;
  }) => string[];
};
const eslint = new ESLint({ cwd });

function severity(rule: Linter.RuleEntry | undefined) {
  const value = Array.isArray(rule) ? rule[0] : rule;
  if (value === "error") return 2;
  if (value === "warn") return 1;
  if (value === "off") return 0;
  return value;
}

describe("the Next ESLint dependency override boundary", () => {
  // Loading the real TypeScript/React ESLint plugins can be slow on a cold CI worker.
  it.each([
    "src/lib/contest-bundle-rewards.ts",
    "src/components/contest/ContestTastingBook.tsx",
  ])("keeps Next rules and uses cwd without root globs for %s", async (file) => {
    const config: Linter.Config | undefined = await eslint.calculateConfigForFile(file);
    expect(config, "The tracked source file must not be ignored").toBeDefined();
    if (!config) throw new Error(`No ESLint configuration for ${file}`);

    expect(config.plugins?.["@next/next"]).toBeDefined();
    const nextRules = Object.entries(nextConfigs["core-web-vitals"].rules ?? {});
    expect(nextRules.length).toBeGreaterThan(0);
    for (const [name, rule] of nextRules) {
      expect(severity(config.rules?.[name]), name).toBe(severity(rule));
      expect(severity(config.rules?.[name]), name).toBeGreaterThan(0);
    }

    expect(config.settings?.next ?? {}).not.toHaveProperty("rootDir");
    // Exercise the installed Next helper with the resolved settings. This does
    // not assert that tinyglobby and fast-glob have equivalent glob semantics.
    expect(getRootDirs({ cwd, settings: config.settings ?? {} })).toEqual([cwd]);
  }, 60_000);
});
