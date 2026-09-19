// Extract registered clothing layers from full-character imagegen edits.
// Every layer keeps the entire 768 x 1280 frame; there is no individual trimming.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const WIDTH = 768, HEIGHT = 1280, COUNT = WIDTH * HEIGHT;
const source = resolve('output/imagegen/sylvain-outfits-v5/source');
const target = resolve('public/contest/avatars/sylvain-outfits-v5');
await mkdir(target, { recursive: true });
const files = new Map();
async function pixels(name) {
  if (!files.has(name)) files.set(name, await sharp(await readFile(resolve(source, `${name}.png`)))
    .resize(WIDTH, HEIGHT, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  return files.get(name);
}
function dilate(mask, radius) {
  const horizontal = new Uint8Array(COUNT), result = new Uint8Array(COUNT);
  for (let y = 0; y < HEIGHT; y++) {
    let count = 0;
    for (let x = -radius; x < WIDTH; x++) {
      if (x + radius < WIDTH) count += mask[y * WIDTH + x + radius];
      if (x - radius - 1 >= 0) count -= mask[y * WIDTH + x - radius - 1];
      if (x >= 0) horizontal[y * WIDTH + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < WIDTH; x++) {
    let count = 0;
    for (let y = -radius; y < HEIGHT; y++) {
      if (y + radius < HEIGHT) count += horizontal[(y + radius) * WIDTH + x];
      if (y - radius - 1 >= 0) count -= horizontal[(y - radius - 1) * WIDTH + x];
      if (y >= 0) result[y * WIDTH + x] = count > 0 ? 1 : 0;
    }
  }
  return result;
}
const teal = (r, g, b) => g > r * 1.55 && b > r * 1.45 && g > 28;
const ink = (r, g, b) => Math.max(r, g, b) < 100;
const skin = (r, g, b) => r > g * 1.18 && g > b * 1.06 && g < b * 1.4 && r < g * 1.85 && b > 60;
const ochre = (r, g, b) => r > g * 1.1 && g > b * 1.45 && b < 170;
const cream = (r, g, b) => r > 180 && g > 180 && b > 150 && r - g < 35;
function garmentMask(data) {
  const seed = new Uint8Array(COUNT);
  for (let p = 0; p < COUNT; p++) if (p / WIDTH > 760 && data[p * 4 + 3] > 10 && teal(...data.subarray(p * 4, p * 4 + 3))) seed[p] = 1;
  const near = dilate(seed, 7);
  for (let p = 0; p < COUNT; p++) if (near[p] && (seed[p] || ink(...data.subarray(p * 4, p * 4 + 3)))) seed[p] = 1;
  return seed;
}

function retainShoes(mask, data) {
  const seen = new Uint8Array(COUNT), groups = [];
  for (let p = 1040 * WIDTH; p < COUNT; p++) {
    if (seen[p] || !mask[p] || data[p * 4 + 3] <= 10) continue;
    const group = [p]; seen[p] = 1;
    for (let i = 0; i < group.length; i++) {
      const q = group[i];
      for (const n of [q - 1, q + 1, q - WIDTH, q + WIDTH]) {
        if (n < 0 || n >= COUNT || seen[n] || !mask[n] || data[n * 4 + 3] <= 10) continue;
        seen[n] = 1; group.push(n);
      }
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.length - a.length);
  if (groups.length < 2 || groups[1].length < 1000) throw new Error('Expected two complete shoes');
  const kept = new Uint8Array(COUNT);
  for (const group of groups.slice(0, 2)) for (const p of group) kept[p] = 1;
  const fringe = dilate(kept, 1);
  for (let p = 0; p < COUNT; p++) mask[p] = mask[p] && fringe[p] ? 1 : 0;
}

// The current crop head has exactly the master placement; remove it from body layers.
const headImage = await sharp('public/contest/avatars/sylvain-v4/head-crop.webp').ensureAlpha().raw().toBuffer();
const head = new Uint8Array(COUNT);
for (let y = 0; y < 682; y++) for (let x = 0; x < WIDTH; x++) {
  if (headImage[((y + 86) * WIDTH + x) * 4 + 3] > 5) head[y * WIDTH + x] = 1;
}
const headMask = dilate(head, 2);
const manifest = {};
async function save(name, data, mask, from) {
  const output = Buffer.from(data);
  for (let p = 0; p < COUNT; p++) if (!mask[p]) output.fill(0, p * 4, p * 4 + 4);
  await sharp(output, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .webp({ lossless: true }).toFile(resolve(target, `${name}.webp`));
  manifest[name] = { source: `${from}.png`, width: WIDTH, height: HEIGHT };
}

for (const code of ['tee', 'overalls', 'hoodie', 'jacket', 'shirt', 'apron']) {
  const name = `top-${code}`, from = code === 'tee' ? 'master' : name;
  const data = await pixels(from), pants = garmentMask(data), mask = new Uint8Array(COUNT);
  for (let p = 0; p < COUNT; p++) {
    const y = Math.floor(p / WIDTH);
    if (y >= 420 && y < 865 && !headMask[p] && !pants[p]) mask[p] = 1;
  }
  await save(name, data, mask, from);
}
for (const code of ['jeans', 'cargo', 'shorts', 'skirt']) {
  const name = `bottom-${code}`, from = code === 'jeans' ? 'master' : name;
  const data = await pixels(from);
  await save(name, data, garmentMask(data), from);
}
for (const code of ['shorts', 'skirt']) {
  const from = `bottom-${code}`, data = await pixels(from), mask = new Uint8Array(COUNT);
  // Legs run behind the footwear and the garment. Their hidden ends overlap the
  // shoe openings; no ankle collar or shoe from this source is retained.
  for (let y = 975; y < 1137; y++) for (let x = 258; x < 505; x++) {
    const p = y * WIDTH + x;
    const rgb = data.subarray(p * 4, p * 4 + 3);
    if (((x >= 274 && x <= 354) || (x >= 415 && x <= 497)) && (skin(...rgb) || ink(...rgb))) mask[p] = 1;
  }
  await save(`legs-${code}`, data, mask, from);
}
const bareLegs = await pixels('bottom-shorts');
const legSkin = new Uint8Array(COUNT);
for (let p = 975 * WIDTH; p < 1137 * WIDTH; p++) {
  if (bareLegs[p * 4 + 3] > 10 && skin(...bareLegs.subarray(p * 4, p * 4 + 3))) legSkin[p] = 1;
}
const legOutline = dilate(legSkin, 5);
for (const code of ['work', 'boots', 'sneakers', 'high-tops']) {
  const name = `shoes-${code}`, from = code === 'work' ? 'bottom-shorts' : name;
  const data = await pixels(from), pants = garmentMask(data), mask = new Uint8Array(COUNT);
  // Follow the drawn shoe collar instead of slicing horizontally through it.
  // Taller shoes were generated on the shorts master so the entire collar exists.
  for (let p = 0; p < COUNT; p++) {
    const rgb = data.subarray(p * 4, p * 4 + 3);
    if (Math.floor(p / WIDTH) >= 1040 && data[p * 4 + 3] > 10 && (ochre(...rgb) || cream(...rgb))) mask[p] = 1;
  }
  const near = dilate(mask, 7);
  for (let p = 0; p < COUNT; p++) if (near[p] && !pants[p] && ink(...data.subarray(p * 4, p * 4 + 3))) mask[p] = 1;
  // The master legs already have their own layer. Remove their unchanged skin
  // and ink from the shoe edit, including slight registration/antialias drift.
  for (let p = 1040 * WIDTH; p < 1137 * WIDTH; p++) {
    if (!mask[p] || !legOutline[p]) continue;
    const i = p * 4;
    let unchanged = false;
    for (const delta of [-WIDTH - 1, -WIDTH, -WIDTH + 1, -1, 0, 1, WIDTH - 1, WIDTH, WIDTH + 1]) {
      const j = (p + delta) * 4;
      if (bareLegs[j + 3] > 100 && Math.max(Math.abs(data[i] - bareLegs[j]), Math.abs(data[i + 1] - bareLegs[j + 1]), Math.abs(data[i + 2] - bareLegs[j + 2])) < 30) { unchanged = true; break; }
    }
    if (unchanged) mask[p] = 0;
  }
  // Measured empty margin above each COMPLETE collar in its generated edit.
  // The few ink strokes above this margin belong to the original bare shins.
  const collarMargin = { work: 1095, boots: 1059, sneakers: 1100, 'high-tops': 1070 }[code];
  mask.fill(0, 0, collarMargin * WIDTH);
  retainShoes(mask, data);
  await save(name, data, mask, from);
}
await writeFile(resolve(source, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${Object.keys(manifest).length} registered clothing/leg/footwear layers.`);
