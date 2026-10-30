// Keep the complete registered head frame. Only standalone ornaments use a tight crop.
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('output/imagegen/chanvrier-v6/source');
const destination = resolve('public/contest/avatars/chanvrier-v6');
await mkdir(destination, { recursive: true });
const entries = (await readdir(source)).filter(name => name === 'head-crop.png' || /^(patch-|accessory-).+\.png$/.test(name)).sort();
const manifest = [];
for (const name of entries) {
  const input = resolve(source, name);
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw new Error(`Missing transparency: ${name}`);
  const ornament = name.startsWith('accessory-');
  if (!ornament && meta.width !== meta.height) throw new Error(`Head frame is not square: ${name}`);
  const width = ornament ? (name.includes('earrings') ? 96 : 420) : 768;
  const height = ornament ? (name.includes('earrings') ? 128 : 320) : 768;
  const output = name.replace(/\.png$/, '.webp');
  await sharp(input).resize(width, height, { fit: 'fill' }).webp({ lossless: true }).toFile(resolve(destination, output));
  manifest.push({ source: input, output, width, height, alpha: true });
}
await writeFile(resolve('output/imagegen/chanvrier-v6/features-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${entries.length} v6 face/ornament assets.`);
