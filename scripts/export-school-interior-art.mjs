/** Export the hemp school interior and its registered animation layers. */
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const generated = 'C:/Users/sylva/.codex/generated_images/01a1cc9c-af01-71e0-a0e6-59f0eb060d0f';
const raw = 'output/school/artwork';
const dest = 'public/placard/school';
await mkdir(raw, { recursive: true });
await mkdir(dest, { recursive: true });
for (const [name, file] of Object.entries({
  'interior-v4': 'exec-6d32017b-e4d4-4918-8922-1782e849f045.png',
  'interior-clean-v4': 'exec-9c902b5f-b0be-49d1-8dd5-20995c8623f1.png',
})) {
  const target = `${raw}/${name}-source.png`;
  try { await stat(target); } catch { await copyFile(`${generated}/${file}`, target); }
}
const original = await readFile(`${raw}/interior-v4-source.png`);
const clean = await readFile(`${raw}/interior-clean-v4-source.png`);
const pieces = [
  { id: 'pendant', kind: 'sway', duration: 5.4,
    path: 'M766 121L775 121L776 127Q790 129 788 143Q807 148 814 177Q832 187 821 207Q810 215 789 217Q785 231 771 231Q753 231 749 217Q725 214 720 205Q711 191 721 183L736 174Q739 150 756 143Q753 132 765 127Z',
    region: { left: 710, top: 120, width: 122, height: 116 } },
  { id: 'herbarium', kind: 'float', duration: 7.2,
    path: 'M185 528Q188 525 193 520L196 516Q227 502 259 499Q276 483 319 474Q324 473 328 480L372 550L372 560Q381 562 379 565L325 585Q324 592 316 592L240 620Q235 620 231 613L183 536Q181 531 185 528Z',
    region: { left: 178, top: 468, width: 208, height: 158 } },
];
const patches = [];
const sprites = [];
for (const item of pieces) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><path d="${item.path}" fill="white" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`);
  const sprite = await sharp(original).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const src = `${dest}/interior-${item.id}-v4.webp`;
  await sharp(sprite).extract(item.region).webp({ lossless: true }).toFile(src);
  // Only replace the removal zones, keeping the rest of the original painting exact.
  // The generated clean plate removed the bracket too: keep its original metal
  // attachment above the gold ring, which stays outside the animated cut.
  const clip = item.id === 'pendant' ? '<defs><clipPath id="mount"><rect x="0" y="124" width="1536" height="900"/></clipPath></defs>' : '';
  const expanded = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024">${clip}<path d="${item.path}" ${clip ? 'clip-path="url(#mount)"' : ''} fill="white" stroke="white" stroke-width="12" stroke-linejoin="round"/></svg>`);
  const patch = await sharp(clean).ensureAlpha().composite([{ input: expanded, blend: 'dest-in' }]).png().toBuffer();
  patches.push({ input: patch });
  sprites.push({ id: item.id, kind: item.kind, duration: item.duration, src: `/${src.replace('public/', '')}`, x: item.region.left, y: item.region.top, width: item.region.width, height: item.region.height });
}
await sharp(original).webp({ quality: 90 }).toFile(`${dest}/interior-v4.webp`);
await sharp(original).composite(patches).webp({ quality: 90 }).toFile(`${dest}/interior-clean-v4.webp`);
await writeFile('src/components/placard/KqSchoolInterior.sprites.json', JSON.stringify({ baseSrc: '/placard/school/interior-clean-v4.webp', sprites }, null, 2) + '\n');
const assets = await Promise.all(['interior-v4', 'interior-clean-v4', 'interior-pendant-v4', 'interior-herbarium-v4'].map(async name => ({ path: `${dest}/${name}.webp`, bytes: (await stat(`${dest}/${name}.webp`)).size })));
await writeFile(`${raw}/interior-v4-verification.json`, JSON.stringify({ assets, pieces }, null, 2) + '\n');
console.log(JSON.stringify({ interior: 'v4', assets }));
