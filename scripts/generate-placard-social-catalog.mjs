// Freeze the deployed V1 catalog and fixture for legacy save regressions.
// Only --check is allowed. V2 uses the shared TypeScript server engine directly.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = path.join(root, "scripts/fixtures/kanab-quest-social-catalog.json");
const migrationPath = path.join(root, "supabase/migrations/20261022000100_kq_social_adventure.sql");
const marker = /\$social_catalog\$([\s\S]*?)\$social_catalog\$/g;
const args = process.argv.slice(2);
if (args.some(argument => argument !== "--check") || args.length > 1) throw new Error("Usage: node scripts/generate-placard-social-catalog.mjs [--check]");
const check = args.includes("--check");
if (!check) throw new Error("La migration V1 est déjà appliquée : seul --check est autorisé. Le catalogue V2 est résolu par le moteur serveur partagé.");
const vite = await createServer({ root, configFile: false, envDir: false,
  resolve: { alias: { "@": path.join(root, "src") } }, server: { middlewareMode: true, watch: null } });

try {
  const { KQ_SOCIAL_SCENARIOS: catalog } = await vite.ssrLoadModule("/src/lib/kanab-quest-social-v1.ts");
  const source = await readFile(migrationPath, "utf8");
  const matches = [...source.matchAll(marker)];
  assert.equal(matches.length, 1, "Expected exactly one delimited social catalog in the migration");
  for (const platform of ["instagram", "x"]) {
    const stories = catalog.filter(story => story.platform === platform);
    assert.equal(stories.length, 6, `The SQL rotation requires six ${platform} stories`);
    assert(stories.every(story => story.choices.length === 3), "Every story requires three choices");
  }
  const json = JSON.stringify(catalog, null, 2);
  assert(!json.includes("$social_catalog$") && !json.includes("$catalog_function$"), "Catalog text must not close a SQL dollar delimiter");
  if (check) {
    assert.deepEqual(JSON.parse(await readFile(fixturePath, "utf8")), catalog, "Legacy fixture differs from the frozen V1 TypeScript catalog");
    assert.deepEqual(JSON.parse(matches[0][1]), catalog, "Applied SQL differs from the frozen V1 TypeScript catalog");
    console.log("Legacy V1 catalog preserved: 12 stories and 36 choices in TypeScript, fixture and applied SQL.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await vite.close(); }
