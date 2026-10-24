import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

// Rebuild from the preserved image_gen PNGs, never from an already compressed WebP.
// Masters stay in ignored output/; only the compact files in public/ are published.
const root = process.cwd();
const provenancePath = resolve(root, "docs/bete-de-concours/social-scenes-provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const encoding = { format: "webp", width: 768, height: 768, quality: 72, effort: 6 };
const evidence = [];
for (const asset of provenance.assets) {
  if (!/^[a-z0-9-]+$/.test(asset.id)) throw new Error(`Invalid scene id: ${asset.id}`);
  if (!/^output\/imagegen\/[a-z0-9/-]+\.png$/.test(asset.master)) throw new Error(`Invalid master path: ${asset.id}`);
  if (!new RegExp(`^public/app/kanab-quest/social/scenes/${asset.id}(?:-[a-z0-9-]+)?\\.webp$`).test(asset.path)) throw new Error(`Invalid public path: ${asset.id}`);
  const master = resolve(root, asset.master);
  const target = resolve(root, asset.path);
  const previousBytes = await stat(target).then(value => value.size, () => Number.isSafeInteger(asset.bytes) ? asset.bytes : 0);
  await mkdir(dirname(target), { recursive: true });
  const image = sharp(master);
  const metadata = await image.metadata();
  if (metadata.width !== metadata.height) throw new Error(`Scene must stay square: ${asset.id}`);
  const output = await image.resize(encoding.width, encoding.height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: encoding.quality, effort: encoding.effort }).toBuffer();
  await writeFile(target, output);
  Object.assign(asset, { bytes: output.length, sha256: createHash("sha256").update(output).digest("hex") });
  evidence.push({ id: asset.id, previousBytes, bytes: output.length, masterBytes: (await stat(master)).size });
}
provenance.encoding = encoding;
provenance.storage = "Static site assets; no Supabase Storage or database image payload. Masters are excluded from Git under output/.";
provenance.totalBytes = evidence.reduce((sum, entry) => sum + entry.bytes, 0);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
const report = { count: evidence.length, beforeBytes: evidence.reduce((sum, entry) => sum + entry.previousBytes, 0), afterBytes: provenance.totalBytes, masterBytes: evidence.reduce((sum, entry) => sum + entry.masterBytes, 0), encoding, assets: evidence };
const reportPath = resolve(root, "output/imagegen/social-scenes/compression-report.json");
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ count: report.count, beforeBytes: report.beforeBytes, afterBytes: report.afterBytes, savedPercent: report.beforeBytes ? Math.round((1 - report.afterBytes / report.beforeBytes) * 100) : null, masterBytes: report.masterBytes }));
