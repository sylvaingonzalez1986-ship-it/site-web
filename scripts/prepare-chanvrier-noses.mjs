// Package complete, aligned image-generator edits; keep the transparent master frame.
import sharp from 'sharp';
import { resolve } from 'node:path';

for (const nose of ['small', 'wide']) {
  const source = resolve(`output/imagegen/chanvrier-noses/source/nose-${nose}.png`);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== metadata.height || !metadata.hasAlpha) {
    throw new Error(`Expected a square transparent head master: ${source}`);
  }
  await sharp(source).resize(768, 768).webp({ lossless: true })
    .toFile(resolve(`public/contest/avatars/sylvain-v4/patch-nose-${nose}.webp`));
}
console.log('Prepared two distinct nose illustrations in the common head frame.');
