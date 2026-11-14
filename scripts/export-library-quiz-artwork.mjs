/** Export the imagegen library edit, its vignette and the sign's clean backing. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const dir = 'output/school/library-quiz-artwork';
const map = 'public/placard/map/placard-world-library-v8.webp';
const vignette = 'public/placard/ui/school-v2.webp';
const backing = 'public/placard/map/living-v2/clean-patches-library-v1.webp';
await mkdir('public/placard/map/living-v2', { recursive: true });
const original = 'public/placard/map/placard-world-school-v7.webp';
// Restrict the generated edit to the existing school's footprint and doorstep.
const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><path fill="white" d="M130 770L265 645L280 645L280 582L379 582L379 649L450 652L510 710L535 930L130 930Z"/></svg>');
const overlay = await sharp(`${dir}/map-source.png`).resize(1536, 1024).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
await sharp(original).composite([{ input: overlay }]).webp({ lossless: true }).toFile(map);
const sourceMetadata = await sharp(`${dir}/library-transparent.png`).metadata();
assert(sourceMetadata.hasAlpha, 'The imagegen vignette must retain its transparent background');
await sharp(`${dir}/library-transparent.png`).resize(512, 512).webp({ quality: 90, alphaQuality: 100 }).toFile(vignette);

// The generated close-up is registered to x195/y700, 200×200 map pixels.
const cleanCloseup = await sharp(`${dir}/sign-backing-source.png`).resize(200, 200).png().toBuffer();
const signBacking = await sharp(cleanCloseup).extract({ left: 16, top: 36, width: 173, height: 70 }).png().toBuffer();
await sharp('public/placard/map/living-v1/clean-patches.webp')
  .extend({ right: 173, background: '#00000000' })
  .composite([{ input: signBacking, left: 592, top: 0 }])
  .webp({ lossless: true }).toFile(backing);

const before = await sharp(original).ensureAlpha().raw().toBuffer();
const after = await sharp(map).ensureAlpha().raw().toBuffer();
const alpha = await sharp(mask).ensureAlpha().raw().toBuffer();
let outsideChanges = 0;
for (let i = 0; i < before.length; i += 4) {
  if (alpha[i + 3] === 0 && (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2])) outsideChanges++;
}
assert.equal(outsideChanges, 0, 'The rest of the village must remain pixel-identical');
const { data: vignettePixels } = await sharp(vignette).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(vignettePixels[3], 0, 'The vignette corner must be fully transparent');
const verification = { outsideChangedPixels: outsideChanges, vignetteHasAlpha: sourceMetadata.hasAlpha, map, vignette, backing };
await writeFile(`${dir}/verification.json`, JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify(verification));
