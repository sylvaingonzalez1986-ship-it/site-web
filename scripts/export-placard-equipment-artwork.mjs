/** Unpack imagegen's sprite atlases without cutting objects at approximate grid edges. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Provide the generated-images source directory.');
const destination = path.resolve('public/placard/equipment-sylvain-v1');
const manifest = JSON.parse(await fs.readFile(path.join(destination, 'manifest.json'), 'utf8'));
const report = [];

for (const sheet of manifest.assets) {
  const input = path.join(sourceDirectory, sheet.source);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const labels = new Uint32Array(width * height);
  const queue = new Uint32Array(width * height);
  const regions = [];
  let nextId = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] <= 4) continue;
    const id = ++nextId;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = start;
    labels[start] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (!labels[neighbor] && data[neighbor * 4 + 3] > 4) {
          labels[neighbor] = id;
          queue[tail++] = neighbor;
        }
      }
    }
    if (tail >= 25) {
      const column = Math.min(2, Math.floor((left + right) / 2 / width * 3));
      const row = Math.min(2, Math.floor((top + bottom) / 2 / height * 3));
      regions.push({ id, left, right, top, bottom, pixels: tail, cell: row * 3 + column });
    }
  }
  for (let index = 0; index < sheet.cells.length; index++) {
    const name = sheet.cells[index];
    if (sheet.excludedCells?.includes(name)) continue;
    const parts = regions.filter(region => region.cell === index);
    if (!parts.length) throw new Error(`No object found for ${name}`);
    const ids = new Set(parts.map(part => part.id));
    const left = Math.min(...parts.map(part => part.left)), top = Math.min(...parts.map(part => part.top));
    const cropWidth = Math.max(...parts.map(part => part.right)) - left + 1;
    const cropHeight = Math.max(...parts.map(part => part.bottom)) - top + 1;
    const cropped = Buffer.alloc(cropWidth * cropHeight * 4);
    for (let y = 0; y < cropHeight; y++) for (let x = 0; x < cropWidth; x++) {
      const sourcePixel = (y + top) * width + x + left;
      if (ids.has(labels[sourcePixel])) data.copy(cropped, (y * cropWidth + x) * 4, sourcePixel * 4, sourcePixel * 4 + 4);
    }
    const result = await sharp(cropped, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
      .resize(480, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(destination, `${name}.webp`));
    report.push({ name, parts: parts.length, sourceBounds: { left, top, width: cropWidth, height: cropHeight }, bytes: result.size });
  }
  console.log(`${sheet.name}: sprites exported`);
}
await fs.mkdir('output/equipment-sylvain', { recursive: true });
await fs.writeFile('output/equipment-sylvain/export-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${report.length} sprites exported; ${Math.round(report.reduce((sum, item) => sum + item.bytes, 0) / 1024)} KiB`);
