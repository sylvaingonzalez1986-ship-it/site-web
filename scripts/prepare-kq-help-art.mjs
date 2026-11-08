// Crop and package the generated atlas; all drawing comes from image_gen.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = 'artwork/ui-help-sheet-v1.png';
const provenance = 'docs/bete-de-concours/ui-help-illustration-provenance.json';
const keys = ['team', 'plan', 'time', 'culture', 'workshop', 'travel', 'social', 'accounts', 'training', 'rest', 'care', 'quality'];
const input = await readFile(resolve(source));
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const assets = [];
await mkdir(resolve('public/placard/ui'), { recursive: true });
for (const [index, key] of keys.entries()) {
  const x0 = Math.round(index % 3 * info.width / 3), x1 = Math.round((index % 3 + 1) * info.width / 3);
  const y0 = Math.round(Math.floor(index / 3) * info.height / 4), y1 = Math.round((Math.floor(index / 3) + 1) * info.height / 4);
  let left = x1, top = y1, right = x0, bottom = y0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 100) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (right <= left || bottom <= top) throw new Error('Empty vignette: ' + key);
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const path = `/placard/ui/help-${key}-v1.webp`;
  await sharp(input).extract(crop).resize(480, 480, { fit: 'contain', background: '#00000000' }).extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' }).webp({ quality: 88, alphaQuality: 100 }).toFile(resolve('public' + path));
  assets.push({ kind: `help-${key}`, path, crop, width: 512, height: 512, transparent: true });
}
const doc = JSON.parse(await readFile(resolve(provenance), 'utf8'));
await writeFile(resolve(provenance), JSON.stringify({ ...doc, source, sourceDimensions: { width: info.width, height: info.height }, processing: 'Sharp: alpha bounding boxes within 3 × 4 grid, proportional fit and transparent padding; no drawn replacement art.', assets }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: assets.length, sourceSize: `${info.width}x${info.height}`, assets: assets.map(asset => asset.path) }));
