/** Pack the imagegen QuizzShow artwork and register its animated sign. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const dir = 'output/quizzshow';
const original = 'public/placard/map/placard-world-library-v8.webp';
const map = 'public/placard/map/placard-world-quizzshow-v9.webp';
const vignette = 'public/placard/ui/school-v3.webp';
const backing = 'public/placard/map/living-v2/clean-patches-quizzshow-v1.webp';
await mkdir('public/placard/map/living-v2', { recursive: true });
// Reuse the previous library footprint so all other destinations remain intact.
const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><path fill="white" d="M130 770L265 645L280 645L280 582L379 582L379 649L450 652L510 710L535 930L130 930Z"/></svg>');
const overlay = await sharp(`${dir}/map-source.png`).resize(1536, 1024).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
await sharp(original).composite([{ input: overlay }]).webp({ lossless: true }).toFile(map);

const metadata = await sharp(`${dir}/quizzshow-transparent.png`).metadata();
assert(metadata.hasAlpha, 'Preserve imagegen transparency in the navigation vignette');
await sharp(`${dir}/quizzshow-transparent.png`).resize(512, 512).webp({ quality: 90, alphaQuality: 100 }).toFile(vignette);

// The generated clean close-up covers map x175/y690, 250×250 pixels.
const cleanCloseup = await sharp(`${dir}/sign-backing-source.png`).resize(250, 250).png().toBuffer();
const signBacking = await sharp(cleanCloseup).extract({ left: 18, top: 44, width: 210, height: 78 }).png().toBuffer();
await sharp('public/placard/map/living-v1/clean-patches.webp')
  .extend({ right: 210, background: '#00000000' })
  .composite([{ input: signBacking, left: 592, top: 0 }])
  .webp({ lossless: true }).toFile(backing);

const before = await sharp(original).ensureAlpha().raw().toBuffer();
const after = await sharp(map).ensureAlpha().raw().toBuffer();
const alpha = await sharp(mask).ensureAlpha().raw().toBuffer();
let outsideChangedPixels = 0;
for (let i = 0; i < before.length; i += 4) {
  if (alpha[i + 3] === 0 && (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2])) outsideChangedPixels++;
}
assert.equal(outsideChangedPixels, 0, 'Every pixel outside QuizzShow must remain identical');
const { data, info } = await sharp(vignette).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const corners = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1];
assert(corners.every(pixel => data[pixel * 4 + 3] === 0), 'All vignette corners must be transparent');
const verification = { outsideChangedPixels, vignetteHasAlpha: metadata.hasAlpha, map, vignette, backing };
await writeFile(`${dir}/artwork-verification.json`, JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify(verification));
