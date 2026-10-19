// Reuse the real warehouse -> zones -> campaigns integration chain, applying
// the new migration before new campaigns. Historical fixture files stay intact.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const sourceUrl = new URL("./test-placard-shared-campaigns.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
// The older suite optionally audits a local deployment dossier. This CI suite
// validates production functions directly and must not require that dossier.
const catalogStart = source.indexOf("  const runCatalogCheck = async (file, key) => {");
const catalogEnd = '  await runCatalogCheck("preflight", "preflight");';
const catalogEndIndex = source.indexOf(catalogEnd, catalogStart);
assert(catalogStart >= 0 && catalogEndIndex > catalogStart, "campaign deployment catalog fixture markers changed");
source = source.slice(0, catalogStart) + source.slice(catalogEndIndex + catalogEnd.length);
const verificationCall = '  await runCatalogCheck("verification", "verification");';
assert(source.includes(verificationCall), "campaign deployment verification marker changed");
source = source.replace(verificationCall, "");
assert(!source.includes("runCatalogCheck"), "deployment catalog checks must be fully removed");
const readPortableFixture = (file, ...options) => {
  const filename = (file instanceof URL ? file.pathname : String(file)).replaceAll("\\", "/");
  assert(!/(?:^|\/)output(?:\/|$)/i.test(filename), "integration fixtures must not read local output artifacts");
  return readFile(file, ...options);
};
const migrationAnchor = '  console.log("Applied shared campaign migration after the deployed zone chain.");';
assert(source.includes(migrationAnchor), "campaign migration fixture marker changed");
source = source.replace(migrationAnchor, `${migrationAnchor}
  // These source definitions exist in production; this smaller commerce fixture
  // omits their dependencies because this suite exercises the culture pipeline.
  await db.exec("SET check_function_bodies=false");
  await db.exec((await definition("20261015000200_kq_mission_aroma_evidence.sql", "kq_mission_metrics")).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"));
  if (!await scalar("SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.kq_flowers'::REGCLASS AND conname='kq_flowers_quality_check')")) {
    await db.exec("ALTER TABLE kq_flowers ADD CONSTRAINT kq_flowers_quality_check CHECK(quality BETWEEN -6 AND 30)");
  }
  await db.exec(await sql("20261018000900_kq_harvest_tiers_v2.sql"));
  await db.exec("SET check_function_bodies=true");
  const oldProtocolOwner=await player(plan(1));
  const oldProtocolStart=await start(oldProtocolOwner,"zone-0",buddieCodes[0]);
  equal(oldProtocolStart.run.state.harvestTierVersion,2,"real independent starter accepts the old protocol without a version marker");
`);

const loop = `    while (completed.phase !== "complete") {
      if (completed.phase === "prepare") completed = game.rollKqDice(completed);
      else if (completed.phase === "rolled") completed = game.resolveKqStage({ ...completed, dice: [6, 6, 6] });
      else completed = game.advanceKqStage(completed);
    }`;
assert(source.includes(loop), "campaign completion fixture marker changed");
source = source.replace(loop, `    while (completed.phase !== "complete") {
      saved = await row(leadId);
      const kind = saved.state.phase === "prepare" ? "roll" : saved.state.phase === "rolled" ? "resolve" : "advance";
      completed = kind === "roll" ? game.rollKqDice(saved.state)
        : kind === "resolve" ? game.resolveKqStage({ ...saved.state, dice: [6, 6, 6] }) : game.advanceKqStage(saved.state);
      if (completed.phase !== "complete") await action(owner,saved,completed,kind);
    }
    equal((await runRows(owner)).map(run=>run.state.history.length),[6,6,6],"six real persisted resolutions synchronize the whole campaign");`);
const finalAnchor = '    equal(final.flowers.length, 3, "one distinct flower per culture in one transaction");';
assert(source.includes(finalAnchor), "campaign finalization fixture marker changed");
source = source.replace(finalAnchor, `${finalAnchor}
    equal(final.flowers.map(flower=>flower.harvest_tier_version),[2,2,2],"every campaign flower retains the server-selected title version");
    const expectedSuccessful=completed.history.filter(entry=>["success","critical"].includes(entry.outcome)).length;
    const expectedCritical=completed.history.filter(entry=>entry.outcome==="critical").length;
    equal(final.flowers.map(flower=>[flower.successful_stages,flower.critical_stages]),Array.from({length:3},()=>[expectedSuccessful,expectedCritical]),"each campaign flower archives actual shared outcomes");`);
const rareAnchor = "    const rareRun = await launch(rare, rarePrepared);";
assert(source.includes(rareAnchor), "rare campaign fixture marker changed");
source = source.replace(rareAnchor, `    for(const member of rarePrepared.members) delete member.state.harvestTierVersion;
${rareAnchor}
    equal((await runRows(rare)).map(run=>run.state.harvestTierVersion),[2,2],"old server campaign input gets canonical version2 after Heritage XP restoration");`);

source = source.replace(/^import .*;\n/gm, "")
  .replace('const sourceUrl = new URL("./test-placard-zone-cultures.mjs", import.meta.url);',
    `const sourceUrl = new URL("./test-placard-zone-cultures.mjs", ${JSON.stringify(sourceUrl.href)});`);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", source)(assert, randomUUID, readPortableFixture, path, createServer, PGlite);
if (!process.exitCode) console.log("Harvest tiers: real zone/campaign starts, six persisted resolutions, atomic flowers and old-server protocol passed.");
