import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createServer } from "vite";

// Usage: node scripts/generate-producer-heritage-fronts.mjs [manifest.json] [--check]
// --check validates the live effect templates and all text without requiring art
// or writing files. Normal generation preflights every illustration first.
const ROOT = process.cwd();
const WIDTH = 1024;
const HEIGHT = 1536;
const INK = "#233628";
const GOLD = "#e4bd51";
const PAPER = "#fff8e8";
const CHECK_ONLY = process.argv.includes("--check");
const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--check");
if (arguments_.length > 1 || arguments_.some((argument) => argument.startsWith("--"))) {
  throw new Error("Usage : node scripts/generate-producer-heritage-fronts.mjs [manifest.json] [--check]");
}
const manifestPath = path.resolve(ROOT, arguments_[0] ?? "src/data/producer-heritage-cards.json");
const manifest = JSON.parse((await readFile(manifestPath, "utf8")).replace(/^\uFEFF/, ""));
if (manifest.version !== 1 || !Array.isArray(manifest.cards) || manifest.cards.length === 0) {
  throw new Error("Manifeste Héritage invalide : version 1 et cartes requises.");
}

for (const [file, family] of [
  ["BarlowCondensed-Bold.ttf", "HeritageDisplay"],
  ["SpaceGrotesk-Bold.ttf", "HeritageBody"],
  ["SpaceGrotesk-Regular.ttf", "HeritageRegular"],
]) {
  if (!GlobalFonts.registerFromPath(path.join(ROOT, "public/fonts/invoice", file), family)) {
    throw new Error(`Police introuvable : ${file}`);
  }
}

// Compare the editorial manifest with the engine, so a stale export cannot
// silently print a different benefit or timing from the playable ability.
const vite = await createServer({
  configFile: false,
  envDir: false,
  resolve: { alias: { "@": path.join(ROOT, "src") } },
  server: { middlewareMode: true, watch: null },
});
let templates;
try {
  ({ KQ_HERITAGE_EFFECT_TEMPLATES: templates } = await vite.ssrLoadModule("/src/lib/kanab-quest-heritage.ts"));
} finally {
  await vite.close();
}

const seenCodes = new Set();
const seenProducers = new Set();
const seenEffects = new Set();
const seenFronts = new Set();
for (const card of manifest.cards) {
  for (const field of ["code", "producerId", "producerName", "name", "effect", "timing", "description", "drawback", "activationLabel", "illustrationUrl", "frontUrl"]) {
    if (typeof card[field] !== "string" || !card[field].trim()) {
      throw new Error(`Champ manquant ${field} pour ${card.code ?? "carte inconnue"}`);
    }
  }
  if (!/^HERITAGE-\d{3,6}$/.test(card.code)) throw new Error(`Code invalide : ${card.code}`);
  if (!Number.isFinite(card.focalY) || card.focalY < 0 || card.focalY > 1) {
    throw new Error(`${card.code} : cadrage focalY invalide (nombre entre 0 et 1 requis)`);
  }
  for (const [set, value] of [[seenCodes, card.code], [seenProducers, card.producerId], [seenEffects, card.effect], [seenFronts, card.frontUrl]]) {
    if (set.has(value)) throw new Error(`Doublon éditorial : ${value}`);
    set.add(value);
  }
  const template = templates.find((candidate) => candidate.effect === card.effect);
  if (!template) throw new Error(`Pouvoir absent du moteur : ${card.effect}`);
  for (const field of ["timing", "description", "drawback"]) {
    if (card[field] !== template[field]) throw new Error(`${card.code} : ${field} diverge du modèle ${card.effect}`);
  }
  if (!/^\/app\/kanab-quest\/cards\/[a-z0-9-]+\.(webp|png)$/.test(card.illustrationUrl)) {
    throw new Error(`Illustration locale invalide : ${card.illustrationUrl}`);
  }
  if (!/^\/app\/kanab-quest\/card-fronts\/[a-z0-9-]+\.webp$/.test(card.frontUrl)) {
    throw new Error(`Destination locale invalide : ${card.frontUrl}`);
  }
}

function localFile(url) {
  return path.join(ROOT, "public", url.slice(1));
}

function roundedBlock(ctx, x, y, width, height, radius, fill, stroke = INK, lineWidth = 5) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function label(ctx, value, x, y, size, color = INK, family = "HeritageBody") {
  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function fittedLabel(ctx, card, value, x, y, width, size, minimum, color = INK, family = "HeritageDisplay") {
  while (size >= minimum) {
    ctx.font = `${size}px ${family}`;
    if (ctx.measureText(value).width <= width) {
      label(ctx, value, x, y, size, color, family);
      return;
    }
    size -= 1;
  }
  throw new Error(`${card.code} : titre trop long (${value})`);
}

function wrapText(ctx, value, width) {
  const lines = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    if (ctx.measureText(word).width > width) return null;
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function paragraph(ctx, card, value, x, y, width, size, minimum, maxLines, lineHeight, color, family) {
  while (size >= minimum) {
    ctx.font = `${size}px ${family}`;
    const lines = wrapText(ctx, value, width);
    if (lines && lines.length <= maxLines) {
      lines.forEach((line, index) => label(ctx, line, x, y + index * lineHeight, size, color, family));
      return;
    }
    size -= 1;
  }
  throw new Error(`${card.code} : paragraphe trop long (${value})`);
}

function drawCover(ctx, image, x, y, width, height, focalY) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = Math.min(image.height - sourceHeight, Math.max(0, image.height * focalY - sourceHeight / 2));
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function render(card, art) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  roundedBlock(ctx, 24, 24, 976, 1488, 65, GOLD, INK, 7);
  roundedBlock(ctx, 48, 48, 928, 1440, 49, PAPER, INK, 6);

  roundedBlock(ctx, 72, 72, 880, 130, 28, INK, INK, 0);
  label(ctx, "HÉRITAGE · CARNET DE DÉGUSTATION", 98, 104, 23, GOLD);
  fittedLabel(ctx, card, card.producerName.toUpperCase(), 98, 155, 828, 59, 34, PAPER);

  // Each illustration declares its focal point in the editorial manifest:
  // portraits keep the full head, botanical scenes keep their central subject.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(82, 222, 860, 650, 25);
  ctx.clip();
  if (art) drawCover(ctx, art, 82, 222, 860, 650, card.focalY);
  else {
    ctx.fillStyle = "#e5e1cd";
    ctx.fillRect(82, 222, 860, 650);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(82, 222, 860, 650, 25);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  fittedLabel(ctx, card, card.name.toUpperCase(), 90, 922, 844, 57, 35);
  roundedBlock(ctx, 82, 970, 860, 52, 15, GOLD, INK, 3);
  fittedLabel(ctx, card, card.activationLabel, 100, 996, 824, 29, 22, INK, "HeritageBody");

  roundedBlock(ctx, 82, 1044, 860, 338, 24, "#fffdf6", INK, 4);
  label(ctx, "CAPACITÉ", 108, 1075, 23, "#76601d");
  paragraph(ctx, card, card.description, 108, 1122, 808, 35, 29, 3, 44, INK, "HeritageBody");

  ctx.beginPath();
  ctx.moveTo(108, 1230);
  ctx.lineTo(916, 1230);
  ctx.strokeStyle = "#d6c794";
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, "À SAVOIR", 108, 1257, 21, "#76601d");
  paragraph(ctx, card, card.drawback, 108, 1293, 808, 26, 23, 3, 31, "#4c5546", "HeritageRegular");

  roundedBlock(ctx, 82, 1402, 860, 62, 18, INK, INK, 0);
  label(ctx, card.timing === "passive" ? "PASSIF · CHAQUE CULTURE" : "1 FOIS PAR CULTURE", 104, 1433, 24, PAPER);
  ctx.textAlign = "right";
  label(ctx, card.code, 920, 1433, 24, GOLD);
  ctx.textAlign = "left";
  return canvas;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function writeReview(prepared) {
  const reviewDir = path.join(ROOT, "output/heritage-producers");
  await mkdir(reviewDir, { recursive: true });
  const columns = Math.min(5, prepared.length);
  const rows = Math.ceil(prepared.length / columns);
  const gap = 20;
  const thumbWidth = 256;
  const thumbHeight = 384;
  const width = columns * (thumbWidth + gap) + gap;
  const height = 96 + rows * (thumbHeight + gap);
  const header = createCanvas(width, 76);
  const headerContext = header.getContext("2d");
  label(headerContext, "LES HÉRITAGES DES PRODUCTEURS", gap, 42, 37, INK, "HeritageDisplay");
  label(headerContext, `${prepared.length} cartes · Carnet de dégustation`, gap, 69, 19, "#76601d", "HeritageRegular");
  const composite = [{ input: header.toBuffer("image/png"), top: 0, left: 0 }];
  for (const [index, { png }] of prepared.entries()) {
    composite.push({
      input: await sharp(png).resize(thumbWidth, thumbHeight).png().toBuffer(),
      left: gap + (index % columns) * (thumbWidth + gap),
      top: 96 + Math.floor(index / columns) * (thumbHeight + gap),
    });
  }
  const sheetFile = "heritage-producer-contact-sheet.png";
  await sharp({ create: { width, height, channels: 4, background: PAPER } }).composite(composite).png().toFile(path.join(reviewDir, sheetFile));
  const cardsHtml = prepared.map(({ card }) => {
    const imageSource = path.relative(reviewDir, localFile(card.frontUrl)).split(path.sep).join("/");
    return `<article><a href="${escapeHtml(imageSource)}"><img src="${escapeHtml(imageSource)}" alt="Carte Héritage de ${escapeHtml(card.producerName)} : ${escapeHtml(card.name)}" width="1024" height="1536" loading="lazy"></a><div class="details"><span class="code">${escapeHtml(card.code)}</span><h2>${escapeHtml(card.producerName)}</h2><h3>${escapeHtml(card.name)}</h3><p class="timing">${escapeHtml(card.activationLabel)} · ${card.timing === "passive" ? "Passif" : "1 fois par culture"}</p><p class="benefit">${escapeHtml(card.description)}</p><p class="limit">${escapeHtml(card.drawback)}</p></div></article>`;
  }).join("\n");
  await writeFile(path.join(reviewDir, "index.html"), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Les Héritages des producteurs</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff8e8;color:#233628;font-family:Arial,sans-serif}main{max-width:1440px;margin:auto;padding:42px 24px 70px}header{margin-bottom:32px;border-bottom:2px solid #d6c794;padding-bottom:28px}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:bold;text-transform:uppercase;color:#76601d}h1{font-size:clamp(32px,5vw,56px);line-height:1.08;margin:14px 0}header p{max-width:720px;font-size:18px;line-height:1.55}a{color:inherit}.sheet{font-weight:bold;color:#76601d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(390px,1fr));gap:24px}article{display:flex;gap:20px;background:#fffdf6;border:1px solid #d6c794;border-radius:16px;padding:16px;align-items:flex-start}article>a{width:46%;flex-shrink:0}img{display:block;max-width:100%;height:auto;border-radius:10px}.details{padding-top:10px;min-width:0}.code{font-size:11px;letter-spacing:.12em;color:#76601d}h2{font-size:22px;line-height:1.15;margin:9px 0}h3{font-size:16px;font-weight:normal;margin:0 0 14px}.timing{font-size:10px;line-height:1.6;font-weight:bold;color:#76601d}.benefit{font-size:15px;line-height:1.5}.limit{font-size:12px;line-height:1.5;color:#606a5e;border-top:1px solid #e5ddc9;padding-top:12px}@media(max-width:520px){main{padding:26px 14px}.grid{grid-template-columns:1fr}article{gap:14px;padding:12px}h2{font-size:18px}.benefit{font-size:13px}}
</style></head><body><main><header><div class="eyebrow">Carnet de dégustation · Collection Héritage</div><h1>Les savoir-faire de nos producteurs.</h1><p>${prepared.length} cartes à découvrir : chaque producteur transmet sa spécialité, avec une capacité, un moment d’activation et une limite explicites.</p><a class="sheet" href="${sheetFile}">Ouvrir la planche de toutes les cartes</a></header><section class="grid" aria-label="Cartes Héritage des producteurs">${cardsHtml}</section></main></body></html>\n`, "utf8");
  console.log(`Aperçu : ${path.join(reviewDir, "index.html")}`);
  console.log(`Planche : ${path.join(reviewDir, sheetFile)}`);
}

if (CHECK_ONLY) {
  for (const card of manifest.cards) render(card, null);
  console.log(`${manifest.cards.length} cartes vérifiées : noms, pouvoirs, limitations, timing et mise en page. Aucun fichier généré.`);
} else {
  const missing = [];
  for (const card of manifest.cards) {
    try { await access(localFile(card.illustrationUrl)); }
    catch { missing.push(`${card.code} : ${card.illustrationUrl}`); }
  }
  if (missing.length) throw new Error(`Illustrations manquantes ; aucun recto généré :\n${missing.join("\n")}`);
  // Render every card before publishing any output, including all text fitting
  // checks. A bad manifest or missing illustration never produces half a set.
  const prepared = [];
  for (const card of manifest.cards) {
    const art = await loadImage(localFile(card.illustrationUrl));
    prepared.push({ card, png: render(card, art).toBuffer("image/png") });
  }
  for (const { card, png } of prepared) {
    const outputPath = localFile(card.frontUrl);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await sharp(png).webp({ quality: 91, effort: 5 }).toFile(outputPath);
    console.log(`${card.code} · ${card.producerName} → ${card.frontUrl}`);
  }
  await writeReview(prepared);
  console.log(`${prepared.length} rectos Héritage générés (${WIDTH} × ${HEIGHT}).`);
}
