import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const manifestPath = path.join(root, "src", "lib", "kanab-quest-artwork.ts");
const outputDir = path.join(root, "output");
const manifestSource = await readFile(manifestPath, "utf8");

const illustrationPattern = /"((?:BOTTE|HERITAGE)-\d{3})":\s*"(\/app\/kanab-quest\/cards\/[^\"]+\.webp)"/g;
const illustrations = [...manifestSource.matchAll(illustrationPattern)].map((match) => ({
  code: match[1],
  source: match[2],
}));

if (illustrations.length !== 48) {
  throw new Error(`Manifeste incomplet : 48 cartes attendues, ${illustrations.length} trouvées.`);
}

function getFrontSource({ code, source }) {
  const override = code === "HERITAGE-011" || code === "HERITAGE-012" ? 4 : null;
  const suffix = override
    ? `-front-v${override}.webp`
    : code.startsWith("HERITAGE-")
      ? "-front-v3.webp"
      : "-front-v$1.webp";
  return source.replace("/cards/", "/card-fronts/").replace(/-v(\d+)\.webp$/, suffix);
}

async function renderSheet(name, entries) {
  const columns = 4;
  const cellWidth = 380;
  const cellHeight = 630;
  const cardWidth = 360;
  const cardHeight = 540;
  const rows = Math.ceil(entries.length / columns);
  const composites = [];

  for (const [index, entry] of entries.entries()) {
    const left = (index % columns) * cellWidth + 10;
    const top = Math.floor(index / columns) * cellHeight + 10;
    const src = getFrontSource(entry);
    const thumbnail = await sharp(path.join(publicDir, src.slice(1)))
      .resize(cardWidth, cardHeight, { fit: "contain", background: "#10201b" })
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${cardWidth}" height="58" xmlns="http://www.w3.org/2000/svg">
        <rect width="${cardWidth}" height="58" rx="8" fill="#fff0c9" />
        <text x="14" y="36" font-family="Arial" font-size="24" font-weight="700" fill="#111512">${entry.code}</text>
      </svg>
    `);
    composites.push({ input: thumbnail, left, top });
    composites.push({ input: label, left, top: top + cardHeight + 8 });
  }

  const outputPath = path.join(outputDir, `placard-${name}-card-audit-20260902.webp`);
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: "#10201b",
    },
  })
    .composite(composites)
    .webp({ quality: 90 })
    .toFile(outputPath);
  return outputPath;
}

await mkdir(outputDir, { recursive: true });
const bottePath = await renderSheet("botte", illustrations.filter(({ code }) => code.startsWith("BOTTE-")));
const heritagePath = await renderSheet("heritage", illustrations.filter(({ code }) => code.startsWith("HERITAGE-")));

console.log(`36 cartes La Botte -> ${bottePath}`);
console.log(`12 cartes Héritage -> ${heritagePath}`);
