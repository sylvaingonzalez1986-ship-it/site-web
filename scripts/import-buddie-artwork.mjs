import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [numberArg, sourceArg] = process.argv.slice(2);
const cardNumber = Number(numberArg);
if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 52 || !sourceArg) {
  throw new Error("Usage: node scripts/import-buddie-artwork.mjs <1-52> <generated-image-path>");
}
const source = path.resolve(sourceArg);
const code = `HH2026-${String(cardNumber).padStart(3, "0")}`;
const outputDir = path.resolve("public/app/kanab-quest/buddies");
const output = path.join(outputDir, `${code.toLowerCase()}-scene-v2.webp`);
const metadata = await sharp(source).metadata();
if (!metadata.width || !metadata.height || Math.abs(metadata.width / metadata.height - 0.8) > 0.035) {
  throw new Error(`${code}: illustration must use the approved 4:5 composition`);
}
await mkdir(outputDir, { recursive: true });
await sharp(source).resize(1024, 1280, { fit: "contain", background: "#f8f1dc" }).webp({ quality: 90, effort: 6 }).toFile(output);
const receipts = path.resolve("output/buddies-refonte/receipts");
await mkdir(receipts, { recursive: true });
await writeFile(path.join(receipts, `${code}.json`), JSON.stringify({ code, source, output, originalWidth: metadata.width, originalHeight: metadata.height, importedAt: new Date().toISOString() }, null, 2));
if (!process.argv.includes("--no-activate")) {
  const readyFile = path.resolve("src/lib/buddie-artwork-ready.json");
  let ready = [];
  try { ready = JSON.parse(await readFile(readyFile, "utf8")); } catch { /* First import. */ }
  if (!ready.includes(code)) {
    ready.push(code);
    await writeFile(readyFile, JSON.stringify(ready.sort(), null, 2) + "\n");
  }
}
console.log(JSON.stringify({ code, output, width: 1024, height: 1280 }));
