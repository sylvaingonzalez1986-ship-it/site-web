import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "public", "app", "kanab-quest", "situations");
const outputDir = path.join(root, "output");
const outputPath = path.join(outputDir, "placard-situation-audit-20260902.webp");
const files = (await readdir(sourceDir)).filter((file) => file.endsWith(".webp")).sort();
const columns = 5;
const cellWidth = 300;
const cellHeight = 330;
const rows = Math.ceil(files.length / columns);
const composites = [];

for (const [index, file] of files.entries()) {
  const left = (index % columns) * cellWidth + 10;
  const top = Math.floor(index / columns) * cellHeight + 10;
  const thumbnail = await sharp(path.join(sourceDir, file))
    .resize(280, 280, { fit: "cover" })
    .toBuffer();
  const label = file.replace("situation-", "").replace("-v2.webp", "").replace(".webp", "");
  const labelSvg = Buffer.from(`
    <svg width="280" height="30" xmlns="http://www.w3.org/2000/svg">
      <rect width="280" height="30" fill="#fff0c9" />
      <text x="8" y="20" font-family="Arial" font-size="14" font-weight="700" fill="#111512">${label}</text>
    </svg>
  `);
  composites.push({ input: thumbnail, left, top });
  composites.push({ input: labelSvg, left, top: top + 282 });
}

await mkdir(outputDir, { recursive: true });
await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 4,
    background: "#10201b",
  },
})
  .composite(composites)
  .webp({ quality: 88 })
  .toFile(outputPath);

console.log(`${files.length} situations -> ${outputPath}`);
