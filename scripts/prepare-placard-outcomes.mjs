/** Export generated verdict scenes and a review sheet. No image generation or network calls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const partial = process.argv.includes('--partial');
const manifest = JSON.parse(await readFile(path.join(root, 'docs/bete-de-concours/placard-outcomes-v3-prompts.json'), 'utf8'));
const output = path.join(root, 'output/imagegen/placard-outcomes-v3');
const publicDir = path.join(root, 'public/app/kanab-quest/reactions/stages-v3');
await Promise.all([mkdir(output, { recursive: true }), mkdir(publicDir, { recursive: true })]);
const report = [];
const missing = [];
const seen = new Set();
for (const asset of manifest.assets) {
  const key = `${asset.slug}-${asset.outcome}`;
  assert(!seen.has(key), `Duplicate artwork: ${key}`);
  seen.add(key);
  const source = path.resolve(root, asset.source);
  let metadata;
  try { metadata = await sharp(source).metadata(); }
  catch (error) {
    if (!partial) throw error;
    missing.push(key);
    continue;
  }
  assert(metadata.width >= 1024 && metadata.width === metadata.height, `${key}: square source >= 1024px required`);
  // An alpha channel is allowed only when every pixel is fully opaque.
  // Reject cutout generations; never hide a missing scene with flatten().
  assert(!metadata.hasAlpha || (await sharp(source).stats()).isOpaque, `${key}: transparent source rejected; regenerate an opaque scene`);
  let buffer;
  let quality = 86;
  do {
    buffer = await sharp(source).resize(768, 768).webp({ quality }).toBuffer();
    if (buffer.length <= manifest.format.maximumBytes) break;
    quality -= 4;
  } while (quality >= 62);
  assert(buffer.length <= manifest.format.maximumBytes, `${key}: transfer budget exceeded`);
  assert((await sharp(buffer).stats()).isOpaque, `${key}: transparent WebP rejected`);
  await writeFile(path.join(publicDir, `${key}.webp`), buffer);
  report.push({ key, bytes: buffer.length, width: 768, height: 768, quality, sourceBytes: (await stat(source)).size, sha256: createHash('sha256').update(buffer).digest('hex') });
}
if (!partial) {
  assert.equal(report.length, 29, 'All 24 outcomes and five terminal scenes are required');
  assert.equal(new Set(report.map(item => item.sha256)).size, 29, 'Each scene must be a distinct image');
}
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const label = (text, width, height = 30) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff8e9"/><text x="10" y="21" font-family="Arial" font-size="14" font-weight="bold" fill="#173e36">${escape(text)}</text></svg>`);
const cell = 220;
const imageSize = 206;
const rowHeight = 266;
const composites = [];
const outcomes = ['critical', 'success', 'fragile', 'failure'];
const labels = { critical: 'Exceptionnel', success: 'Réussite', fragile: 'Fragile', failure: 'Échec', dead: 'Culture morte' };
const available = new Set(report.map(item => item.key));
for (let row = 0; row < manifest.stages.length; row++) {
  const stage = manifest.stages[row];
  for (let col = 0; col < outcomes.length; col++) {
    const outcome = outcomes[col];
    const key = `${stage.slug}-${outcome}`;
    const left = col * cell + 7;
    const top = row * rowHeight + 7;
    if (available.has(key)) composites.push({ input: await sharp(path.join(publicDir, `${key}.webp`)).resize(imageSize, imageSize).toBuffer(), left, top });
    composites.push({ input: label(`${row + 1}. ${stage.name}`, imageSize), left, top: top + imageSize });
    composites.push({ input: label(labels[outcome], imageSize), left, top: top + imageSize + 26 });
  }
}
await sharp({ create: { width: cell * 4, height: rowHeight * 6, channels: 3, background: '#dce9d5' } }).composite(composites).webp({ quality: 90 }).toFile(path.join(output, 'outcomes-contact-sheet.webp'));
const terminal = [];
for (const [index, stage] of manifest.stages.filter(stage => stage.terminal).entries()) {
  const left = index * cell + 7;
  const key = `${stage.slug}-dead`;
  if (available.has(key)) terminal.push({ input: await sharp(path.join(publicDir, `${key}.webp`)).resize(imageSize, imageSize).toBuffer(), left, top: 7 });
  terminal.push({ input: label(stage.name, imageSize), left, top: imageSize + 7 });
}
await sharp({ create: { width: cell * 5, height: rowHeight, channels: 3, background: '#f5d9d1' } }).composite(terminal).webp({ quality: 90 }).toFile(path.join(output, 'death-contact-sheet.webp'));
await writeFile(path.join(output, 'export-report.json'), JSON.stringify({ complete: report.length === 29, totalBytes: report.reduce((sum, item) => sum + item.bytes, 0), assets: report, missing }, null, 2) + '\n');
console.log(JSON.stringify({ exported: report.length, missing, totalBytes: report.reduce((sum, item) => sum + item.bytes, 0), output }));
