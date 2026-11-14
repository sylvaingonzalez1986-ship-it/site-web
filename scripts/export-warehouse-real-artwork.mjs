// Preserve imagegen alpha while fitting complete equipment drawings into shop cards.
import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [key, source] = process.argv.slice(2);
if (!key || !/^[a-zA-Z0-9-]+$/.test(key) || !source) throw new Error('Usage: node scripts/export-warehouse-real-artwork.mjs asset-key generated.png');
const original = resolve('output/equipment-reference/generated', `${key}.png`);
const target = resolve('public/placard/equipment-real-v2', `${key}.webp`);
await mkdir(resolve('output/equipment-reference/generated'), { recursive: true });
await mkdir(resolve('public/placard/equipment-real-v2'), { recursive: true });
if (resolve(source) !== original) await copyFile(source, original);
const metadata = await sharp(original).metadata();
if (!metadata.hasAlpha) throw new Error(`${key}: generation must have an alpha channel`);
await sharp(original).trim().resize(480, 480, { fit: 'contain', background: '#00000000' })
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
  .webp({ quality: 88, alphaQuality: 100 }).toFile(target);
const { channels, isOpaque } = await sharp(target).stats();
if (isOpaque || channels[3].min !== 0 || channels[3].max !== 255) throw new Error(`${key}: invalid transparent export`);
await writeFile(resolve('output/equipment-reference/generated', `${key}.export.json`), JSON.stringify({ key, source, original, target, metadata: await sharp(target).metadata(), isOpaque }, null, 2) + '\n');
console.log(`${key}: transparent 512px WebP exported`);
