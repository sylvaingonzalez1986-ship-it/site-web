// Preserve every layer's registered character frame; never trim individual art.
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('output/imagegen/chanvrier-body-v6/source');
const destination = resolve('public/contest/avatars/chanvrier-body-v6');
const expected = [
  'top-overalls', 'top-tee', 'top-hoodie', 'top-jacket', 'top-shirt', 'top-apron',
  'bottom-jeans', 'bottom-cargo', 'bottom-shorts', 'bottom-skirt',
  'shoes-boots', 'shoes-sneakers', 'shoes-high-tops', 'shoes-work', 'legs-shorts', 'legs-skirt',
];
const available = new Set(await readdir(source));
for (const name of expected) {
  if (!available.has(`${name}.png`)) throw new Error(`Missing registered layer: ${name}`);
}
await mkdir(destination, { recursive: true });
const manifest = {};
for (const name of expected) {
  const file = `${name}.png`;
  const input = resolve(source, file);
  const metadata = await sharp(input).metadata();
  if (!metadata.hasAlpha) throw new Error(`${file} must retain generated transparency`);
  await sharp(input).resize(768, 1280, { fit: 'fill' }).webp({ lossless: true }).toFile(resolve(destination, `${name}.webp`));
  manifest[name] = { source: file, generatedWidth: metadata.width, generatedHeight: metadata.height, width: 768, height: 1280 };
}
await writeFile(resolve(source, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${Object.keys(manifest).length} complete 768 x 1280 registered layers.`);
