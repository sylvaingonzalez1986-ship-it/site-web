import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import sharp from "sharp";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: node scripts/import-buddie-flavor-art.mjs <imagegen-manifest.json>");
const entries = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
if (entries.length !== 38 || new Set(entries.map((entry) => entry.code)).size !== 38) {
  throw new Error("Expected 38 distinct generated flavor assets.");
}
const destination = resolve("public/placard/flavors-v1");
mkdirSync(destination, { recursive: true });
const imported = [];
for (const entry of entries) {
  if (!/^[a-z0-9-]+$/.test(entry.code) || !entry.source || !entry.prompt) throw new Error("Invalid flavor manifest entry.");
  const target = resolve(destination, `${entry.code}.webp`);
  if (existsSync(target)) throw new Error(`Refusing to overwrite ${target}. Use a new version for replacement art.`);
  const metadata = await sharp(entry.source).metadata();
  if (!metadata.hasAlpha) throw new Error(`Expected generated transparency for ${entry.code}.`);
  await sharp(entry.source).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 100 }).toFile(target);
  imported.push({ code: entry.code, image: `/placard/flavors-v1/${entry.code}.webp`, generatedFile: basename(entry.source), prompt: entry.prompt });
}
writeFileSync(resolve("docs/bete-de-concours/buddie-flavor-art-v1.json"), `${JSON.stringify({ generator: "Built-in image_gen", transparentBackground: true, size: 192, assets: imported.sort((a, b) => a.code.localeCompare(b.code)) }, null, 2)}\n`);
console.log(`Imported ${imported.length} transparent 192px WebP flavor illustrations.`);
