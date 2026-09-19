import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Packaging only: preserve the alpha produced by imagegen. Never key out colors.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'output/imagegen/warehouse-v2/source');
const target = resolve(root, 'public/placard/warehouse-v2');
const dryRun = process.argv.includes('--dry-run');
const sheets = {
  machines: ['sifting', 'press', 'static-separation', 'washing', 'filtration', 'drying'],
  grow: ['tent-starter', 'tent-pro', 'lighting-starter', 'lighting-pro', 'air-starter', 'air-pro'],
  accessories: ['climate-controller', 'energy', 'security-camera', 'security-dog', 'flower-drying', 'flower-drying-full'],
};
// The first grow sheet has a clean gap between the lower LED and fan. Their
// antialiased silhouettes overlap in the second generation, so retain this
// inspected original instead of clipping or manufacturing a separation mask.
const sourceFiles = { grow: 'grow-original' };
// Reviewed source regions for the 1536 × 1024 generated sheets. Objects do not
// follow exact 512-pixel columns: a regular grid would clip cables and feet.
const reviewedRegions = {
  machines: [[0, 0, 552, 499], [552, 0, 540, 499], [1092, 0, 444, 519], [0, 499, 552, 525], [552, 499, 480, 525], [1032, 519, 504, 505]],
  grow: [[0, 0, 500, 562], [500, 0, 500, 562], [1000, 0, 536, 562], [0, 562, 539, 462], [539, 562, 480, 462], [1019, 562, 517, 462]],
  accessories: [[0, 0, 500, 485], [500, 0, 540, 492], [1040, 0, 496, 492], [0, 485, 520, 539], [520, 492, 530, 532], [1050, 492, 486, 532]],
};
// Low alpha (1–8/255) occurs as scattered, invisible imagegen fringe pixels,
// including a handful at the sheet edge. Ignore it when finding crop bounds,
// but keep every source pixel and its original alpha inside the retained crop.
const boundsAlphaThreshold = 8;
const manifest = {
  version: 1,
  sourceDirectory: relative(root, source).replaceAll('\\', '/'),
  quality: 90,
  margin: 2,
  boundsAlphaThreshold,
  assets: {},
  sources: {},
  warnings: [],
};
let rejected = 0;

function report(message) {
  manifest.warnings.push(message);
  console.warn(message);
}

async function readSource(name, fileName = name) {
  try {
    return await readFile(resolve(source, `${fileName}.png`));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    manifest.sources[name] = { status: 'missing' };
    report(`Missing ${fileName}.png; other available sources will still be processed.`);
    return null;
  }
}

function inspectAlpha(data, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let transparent = 0;
  let opaqueEdge = 0;
  let edgePixels = 0;
  let neutralEdge = 0;
  const edgeTones = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha === 0) transparent += 1;
      if (alpha > boundsAlphaThreshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        edgePixels += 1;
        if (alpha > boundsAlphaThreshold) opaqueEdge += 1;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        if (alpha > 250 && Math.max(red, green, blue) - Math.min(red, green, blue) < 12) {
          neutralEdge += 1;
          const tone = Math.floor((red + green + blue) / 24);
          edgeTones.set(tone, (edgeTones.get(tone) ?? 0) + 1);
        }
      }
    }
  }
  const recurringTones = [...edgeTones.values()].filter((count) => count / edgePixels > 0.1).length;
  const suspectedCheckerboard = neutralEdge / edgePixels > 0.65 && recurringTones >= 2;
  const bounds = right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
  return { bounds, transparent, opaqueEdge, suspectedCheckerboard };
}

async function encode(name, pipeline, details) {
  const { data, info } = await pipeline.webp({ quality: 90, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
  const file = `${name}.webp`;
  if (!dryRun) await writeFile(resolve(target, file), data);
  manifest.assets[name] = { file, width: info.width, height: info.height, bytes: info.size, ...details };
  console.log(`${dryRun ? 'Checked' : 'Built'} ${file}: ${info.width} × ${info.height}`);
}

if (!dryRun) await mkdir(target, { recursive: true });

const room = await readSource('room');
if (room) {
  const metadata = await sharp(room).metadata();
  await encode('room', sharp(room).resize({ width: 1774, withoutEnlargement: true }), {
    source: 'room.png',
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  });
  manifest.sources.room = { status: 'built', width: metadata.width, height: metadata.height };
}

for (const [sheet, names] of Object.entries(sheets)) {
  const sourceName = sourceFiles[sheet] ?? sheet;
  const input = await readSource(sheet, sourceName);
  if (!input) continue;
  const { data, info } = await sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  manifest.sources[sheet] = { status: 'built', source: `${sourceName}.png`, width: info.width, height: info.height, layout: 'reviewed-regions', referenceWidth: 1536, referenceHeight: 1024 };
  for (const [index, name] of names.entries()) {
    const [referenceLeft, referenceTop, referenceWidth, referenceHeight] = reviewedRegions[sheet][index];
    const left = Math.round(referenceLeft * info.width / 1536);
    const top = Math.round(referenceTop * info.height / 1024);
    const cell = {
      left,
      top,
      width: Math.round((referenceLeft + referenceWidth) * info.width / 1536) - left,
      height: Math.round((referenceTop + referenceHeight) * info.height / 1024) - top,
    };
    const raw = await sharp(data, { raw: info }).extract(cell).raw().toBuffer();
    const alpha = inspectAlpha(raw, cell.width, cell.height);
    let problem;
    if (!alpha.bounds) problem = 'empty cell';
    else if (alpha.suspectedCheckerboard) problem = 'possible baked checkerboard or opaque grey background';
    else if (alpha.transparent === 0) problem = 'fully opaque cell: genuine transparent alpha is required';
    else if (alpha.opaqueEdge > 0) problem = 'visible pixels touch the cell edge: possible baked background or object crossing cell boundaries';
    if (problem) {
      rejected += 1;
      manifest.sources[sheet].status = 'rejected-cells';
      report(`Rejected ${sourceName}.png / ${name}: ${problem}. Regenerate or correct the source; no approximate background masking was performed.`);
      continue;
    }
    // Retain two source pixels around the visible silhouette before adding the
    // guaranteed transparent margin. This preserves antialiasing at crop edges.
    const retainedLeft = Math.max(0, alpha.bounds.left - 2);
    const retainedTop = Math.max(0, alpha.bounds.top - 2);
    const retained = {
      left: retainedLeft,
      top: retainedTop,
      width: Math.min(cell.width, alpha.bounds.left + alpha.bounds.width + 2) - retainedLeft,
      height: Math.min(cell.height, alpha.bounds.top + alpha.bounds.height + 2) - retainedTop,
    };
    await encode(name, sharp(raw, { raw: { width: cell.width, height: cell.height, channels: 4 } })
      .extract(retained)
      .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } }), {
      source: `${sourceName}.png`,
      index,
      cell,
      contentBounds: alpha.bounds,
      retainedBounds: retained,
      originalWidth: info.width,
      originalHeight: info.height,
    });
  }
}

if (!dryRun) await writeFile(resolve(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${Object.keys(manifest.assets).length} asset(s) ${dryRun ? 'checked; no files written' : 'written'}, ${rejected} rejected, ${manifest.warnings.length} warning(s).`);
if (rejected) process.exitCode = 1;
