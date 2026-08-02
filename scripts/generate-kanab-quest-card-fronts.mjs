import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_DIR = path.join(ROOT, "public", "app", "kanab-quest", "cards");
const OUT_DIR = path.join(ROOT, "public", "app", "kanab-quest", "card-fronts");
const WIDTH = 1024;
const HEIGHT = 1536;

const categoryStyle = {
  substrate: { label: "SUBSTRAT", color: "#b98345", dark: "#66411f", icon: "SOL" },
  pbi: { label: "AUXILIAIRE PBI", color: "#65bfd0", dark: "#105c6a", icon: "PBI" },
  equipment: { label: "ÉQUIPEMENT", color: "#e98a3c", dark: "#7a3514", icon: "OUTIL" },
  "know-how": { label: "SAVOIR-FAIRE", color: "#6fbd78", dark: "#245b2d", icon: "TECH" },
  luck: { label: "COUP DE CHANCE", color: "#b98bcc", dark: "#623775", icon: "★" },
  heritage: { label: "HÉRITAGE", color: "#e4bd51", dark: "#68470e", icon: "∞" },
};

const rarityStyle = {
  common: { label: "COMMUNE", color: "#e9e2d4" },
  uncommon: { label: "PEU COMMUNE", color: "#b9dce2" },
  rare: { label: "RARE", color: "#efd36b" },
  epic: { label: "ÉPIQUE", color: "#d1a5e5" },
};

const timingLabels = {
  passive: "PASSIF",
  "before-roll": "AVANT LE LANCER",
  "after-roll": "APRÈS LE LANCER",
  "once-per-run": "1 FOIS PAR CULTURE",
};

const artworkByCode = {
  "BOTTE-001": "botte-001-terreau-universel-v1.png",
  "BOTTE-002": "botte-002-chrysope-affamee-v1.png",
  "BOTTE-003": "botte-003-petit-ventilateur-v1.png",
  "BOTTE-004": "botte-004-loupe-inspection-v1.png",
  "BOTTE-005": "botte-005-arrosage-mesure-v1.png",
  "BOTTE-006": "botte-006-deuxieme-chance-v1.png",
  "BOTTE-007": "botte-007-fibre-coco-v1.png",
  "BOTTE-008": "botte-008-melange-drainant-v1.png",
  "BOTTE-009": "botte-009-terre-vivante-v1.png",
  "BOTTE-010": "botte-010-coccinelle-sept-points-v1.png",
  "BOTTE-011": "botte-011-amblyseius-swirskii-v1.png",
  "BOTTE-012": "botte-012-aphidius-colemani-v1.png",
  "BOTTE-013": "botte-013-pot-tissu-v1.png",
  "BOTTE-014": "botte-014-hygrometre-vintage-v1.png",
  "BOTTE-015": "botte-015-palissage-doux-v1.png",
  "BOTTE-016": "botte-016-sechage-patient-v1.png",
  "BOTTE-017": "botte-017-main-verte-v1.png",
  "BOTTE-018": "botte-018-coup-de-pouce-v1.png",
  "BOTTE-019": "botte-019-perlite-horticole-v1.png",
  "BOTTE-020": "botte-020-biochar-v1.png",
  "BOTTE-021": "botte-021-compost-mur-v1.png",
  "BOTTE-022": "botte-022-phytoseiulus-persimilis-v1.png",
  "BOTTE-023": "botte-023-orius-laevigatus-v1.png",
  "BOTTE-024": "botte-024-tensiometre-v1.png",
  "BOTTE-025": "botte-025-filet-anti-insectes-v1.png",
  "BOTTE-026": "botte-026-brasseur-air-v1.png",
  "BOTTE-027": "botte-027-timer-mecanique-v1.png",
  "BOTTE-028": "botte-028-taille-apicale-v1.png",
  "BOTTE-029": "botte-029-effeuillage-mesure-v1.png",
  "BOTTE-030": "botte-030-affinage-bocal-v1.png",
  "BOTTE-031": "botte-031-drainage-controle-v1.png",
  "BOTTE-032": "botte-032-carnet-jardinier-v1.png",
  "BOTTE-033": "botte-033-observation-matinale-v1.png",
  "BOTTE-034": "botte-034-retour-calme-v1.png",
  "BOTTE-035": "botte-035-quarantaine-preventive-v1.png",
  "BOTTE-036": "botte-036-bac-retention-v1.png",
  "HERITAGE-001": "heritage-001-racines-solides-producer-v2.webp",
  "HERITAGE-002": "heritage-002-reserve-jardinier-producer-v2.webp",
  "HERITAGE-003": "heritage-003-main-prevoyante-producer-v2.webp",
  "HERITAGE-004": "heritage-004-climat-stable-producer-v2.webp",
  "HERITAGE-005": "heritage-005-second-regard-producer-v2.webp",
  "HERITAGE-006": "heritage-006-reprise-vigoureuse-producer-v2.webp",
  "HERITAGE-007": "heritage-007-instinct-cultivateur-producer-v2.webp",
  "HERITAGE-008": "heritage-008-bouclier-biologique-producer-v2.webp",
  "HERITAGE-009": "heritage-009-floraison-maitrisee-v1.png",
  "HERITAGE-010": "heritage-010-affinage-patient-v1.png",
  "HERITAGE-011": "heritage-011-canopy-legacy-v1.png",
  "HERITAGE-012": "heritage-012-signature-maitre-v1.png",
};

function extractArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Collection introuvable: ${marker}`);
  const assignment = source.indexOf("=", markerIndex);
  const start = source.indexOf("[", assignment);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return Function(`"use strict"; return (${source.slice(start, index + 1)});`)();
    }
  }
  throw new Error(`Collection incomplète: ${marker}`);
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fillStroke(ctx, fill, stroke, width = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function fitText(ctx, text, maxWidth, startSize, minSize, weight = 900) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > minSize);
  return minSize;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length) {
    let last = lines.at(-1) ?? "";
    while (ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}…`;
  }
  return lines;
}

function drawCover(ctx, image, x, y, width, height, focalY = 0.5) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = Math.min(image.height - sourceHeight, Math.max(0, image.height * focalY - sourceHeight / 2));
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function slugFromArtwork(file) {
  return path.parse(file).name.replace(/-v(\d+)$/, "-front-v$1");
}

async function renderCard(card) {
  const category = categoryStyle[card.category];
  const rarity = rarityStyle[card.rarity];
  const artFile = artworkByCode[card.code];
  if (!category || !rarity || !artFile) throw new Error(`Métadonnées incomplètes pour ${card.code}`);
  const art = await loadImage(path.join(ART_DIR, artFile));
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111512";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  roundedRect(ctx, 28, 28, 968, 1480, 72);
  fillStroke(ctx, "#f3c746", "#111512", 9);
  roundedRect(ctx, 50, 50, 924, 1436, 58);
  fillStroke(ctx, category.color, "#111512", 8);
  roundedRect(ctx, 70, 70, 884, 1396, 46);
  fillStroke(ctx, "#f8f0dc", "#111512", 8);

  roundedRect(ctx, 92, 92, 840, 82, 24);
  fillStroke(ctx, category.dark, "#111512", 5);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "900 29px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(category.label, 124, 133);

  roundedRect(ctx, 785, 102, 125, 62, 18);
  fillStroke(ctx, rarity.color, "#111512", 4);
  ctx.fillStyle = "#111512";
  ctx.font = "900 19px Arial";
  ctx.textAlign = "center";
  ctx.fillText(rarity.label, 847, 133);
  ctx.textAlign = "left";

  ctx.save();
  roundedRect(ctx, 92, 194, 840, 730, 30);
  ctx.clip();
  drawCover(ctx, art, 92, 194, 840, 730, artFile.includes("-producer-") ? 0.35 : 0.5);
  ctx.restore();
  roundedRect(ctx, 92, 194, 840, 730, 30);
  ctx.strokeStyle = "#111512";
  ctx.lineWidth = 7;
  ctx.stroke();

  roundedRect(ctx, 114, 942, 126, 126, 63);
  fillStroke(ctx, category.color, "#111512", 6);
  ctx.fillStyle = "#111512";
  ctx.textAlign = "center";
  ctx.font = category.icon.length > 3 ? "900 21px Arial" : "900 38px Arial";
  ctx.fillText(category.icon, 177, 1005);
  ctx.textAlign = "left";

  ctx.fillStyle = "#111512";
  const titleSize = fitText(ctx, card.name.toUpperCase(), 650, 54, 32);
  ctx.font = `900 ${titleSize}px Arial`;
  ctx.fillText(card.name.toUpperCase(), 265, 976);
  ctx.font = "900 23px Arial";
  ctx.fillStyle = category.dark;
  ctx.fillText(`${timingLabels[card.timing] ?? card.timing.toUpperCase()} · ${card.code}`, 267, 1024);

  roundedRect(ctx, 92, 1092, 840, 250, 28);
  fillStroke(ctx, "#fffaf0", "#111512", 5);
  ctx.fillStyle = "#111512";
  ctx.font = "900 25px Arial";
  ctx.fillText(card.category === "heritage" ? "POUVOIR PERMANENT" : "EFFET DE JEU", 124, 1137);
  ctx.font = "700 34px Arial";
  const lines = wrapText(ctx, card.description, 760, 4);
  lines.forEach((line, index) => ctx.fillText(line, 124, 1190 + index * 43));

  const costLabel = card.category === "heritage"
    ? "NE BRÛLE JAMAIS"
    : card.xpCost === 0
      ? "PASSIF · BRÛLE AU DÉPART"
      : `${card.xpCost} XP · BRÛLE À L’UTILISATION`;
  roundedRect(ctx, 92, 1360, 840, 78, 22);
  fillStroke(ctx, category.dark, "#111512", 5);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "900 18px Arial";
  ctx.fillText(card.category === "heritage" ? "HÉRITAGES DE CONCOURS" : "LA BOTTE DU CHANVRIER", 122, 1399);
  ctx.textAlign = "right";
  ctx.fillText(costLabel, 902, 1399);
  ctx.textAlign = "left";

  const png = canvas.toBuffer("image/png");
  const slug = slugFromArtwork(artFile);
  const pngPath = path.join(OUT_DIR, `${slug}.png`);
  const webpPath = path.join(OUT_DIR, `${slug}.webp`);
  await writeFile(pngPath, png);
  await sharp(png).webp({ quality: 90, effort: 5 }).toFile(webpPath);
  return { code: card.code, pngPath, webpPath };
}

await mkdir(OUT_DIR, { recursive: true });
const gameSource = await readFile(path.join(ROOT, "src", "lib", "kanab-quest-game.ts"), "utf8");
const heritageSource = await readFile(path.join(ROOT, "src", "lib", "kanab-quest-heritage.ts"), "utf8");
const supportCards = extractArray(gameSource, "export const KQ_CARDS").map((card) => ({ ...card }));
const heritageCards = extractArray(heritageSource, "export const KQ_HERITAGE_CARDS").map((card) => ({ ...card, category: "heritage", xpCost: 0 }));
const requestedCodes = new Set((process.env.KQ_CARD_CODES ?? "").split(",").map((code) => code.trim()).filter(Boolean));
const results = [];
for (const card of [...supportCards, ...heritageCards].filter((card) => requestedCodes.size === 0 || requestedCodes.has(card.code))) {
  results.push(await renderCard(card));
}
console.log(`Cartes générées : ${results.length} rectos PNG + WebP dans ${OUT_DIR}`);
