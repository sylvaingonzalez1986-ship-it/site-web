// Local company logos, independent from the runtime price provider.
// Source documentation: https://site.financialmodelingprep.com/developer/docs/company-image-api
// node scripts/refresh-stock-market-logos.mjs --write downloads missing catalog
// logos; --force refreshes existing files too. --normalize-local crops excess
// white margins without network access. Without --write, probe 12 examples.
// Prices, player accounts and the stock instrument catalog are never modified.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const catalog = JSON.parse(await readFile('src/lib/stock-market-catalog.json', 'utf8'));
const manifestPath = 'src/lib/stock-market-logos.json';
const directory = 'public/placard/stocks/logos';
const write = process.argv.includes('--write'), force = process.argv.includes('--force');
const sample = new Set(['AAPL', 'MSFT', 'BRK-B', 'BF-B', 'GOOG', 'GOOGL', 'AIR.PA', 'MC.PA', 'AI.PA', 'MT.AS', 'TTE.PA', 'BNP.PA']);
const instruments = catalog.instruments.filter(asset => asset.kind === 'stock' && (write || sample.has(asset.id)));
const overrides = {
  // The same Airbus identity as FMP's favicon, obtained at native 96px resolution.
  'AIR.PA': 'https://www.airbus.com/themes/custom/airbus_web_experience_ui/favicons/corporate/favicon-96x96.png',
  'EN.PA': 'https://www.bouygues.com/app/uploads/2021/10/cropped-favico-192x192.jpeg',
  'FGR.PA': 'https://www.eiffage.com/modules/EIFFAGEUXDesignTemplates/images/favicon/favicon-96x96.png',
  'TTE.PA': 'https://totalenergies.com/themes/custom/totalenergies_com/dist/img/logo_totalenergies_mobile.png',
  'RNO.PA': 'https://www.renaultgroup.com/favicon.ico',
};
let previous = {};
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const records = [];
await mkdir('output/stock-logo-probes', { recursive: true });
if (write) await mkdir(directory, { recursive: true });

async function normalizeArtwork(bytes) {
  const { data, info } = await sharp(bytes).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [0, info.width - 1, info.width * (info.height - 1), info.width * info.height - 1];
  const whiteCorners = corners.every(pixel => [0, 1, 2].every(channel => data[pixel * info.channels + channel] >= 245));
  let artwork = sharp(bytes);
  if (whiteCorners) artwork = artwork.trim({ background: '#ffffff', threshold: 12 }).resize(80, 80, { fit: 'contain', background: '#ffffff' }).extend({ top: 8, right: 8, bottom: 8, left: 8, background: '#ffffff' });
  return artwork.webp({ quality: 88, effort: 5 }).toBuffer();
}

// Renault's official favicon contains indexed 8-bit Windows icons. Decode its
// largest entry directly; no recoloring, external image service or new package.
async function decodeOfficialIcon(bytes) {
  assert(bytes.length >= 22 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1, 'Invalid ICO');
  const count = bytes.readUInt16LE(4);
  assert(count > 0 && count <= 64 && bytes.length >= 6 + count * 16, 'Invalid ICO directory');
  const entries = Array.from({ length: count }, (_, i) => {
    const at = 6 + i * 16;
    return { width: bytes[at] || 256, height: bytes[at + 1] || 256, size: bytes.readUInt32LE(at + 8), offset: bytes.readUInt32LE(at + 12) };
  }).sort((a, b) => b.width * b.height - a.width * a.height);
  const { width, height, size, offset } = entries[0];
  assert(offset + size <= bytes.length, 'Truncated ICO image');
  const dib = bytes.subarray(offset, offset + size);
  if (dib.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return dib;
  assert(dib.length >= 40 && dib.readUInt32LE(0) === 40 && dib.readInt32LE(4) === width && dib.readInt32LE(8) === height * 2 && dib.readUInt16LE(14) === 8 && dib.readUInt32LE(16) === 0, 'Unsupported ICO bitmap');
  const colors = dib.readUInt32LE(32) || 256, pixelsAt = 40 + colors * 4, stride = Math.ceil(width / 4) * 4, maskStride = Math.ceil(width / 32) * 4, maskAt = pixelsAt + stride * height;
  assert(colors <= 256 && maskAt + maskStride * height <= dib.length, 'Truncated ICO bitmap');
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const row = height - y - 1, color = dib[pixelsAt + row * stride + x], palette = 40 + color * 4, out = (y * width + x) * 4;
    assert(color < colors, 'Invalid ICO palette index');
    rgba[out] = dib[palette + 2]; rgba[out + 1] = dib[palette + 1]; rgba[out + 2] = dib[palette];
    rgba[out + 3] = dib[maskAt + row * maskStride + Math.floor(x / 8)] & (1 << (7 - x % 8)) ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

if (process.argv.includes('--normalize-local')) {
  let normalized = 0;
  for (const { src } of Object.values(previous)) {
    assert(/^\/placard\/stocks\/logos\/[a-z0-9.-]+\.webp$/.test(src), 'Unsafe local logo path');
    const localPath = path.join('public', src);
    await writeFile(localPath, await normalizeArtwork(await readFile(localPath)));
    normalized++;
  }
  console.log(JSON.stringify({ normalized, networkRequests: 0 }));
  process.exit(0);
}

async function download(url) {
  const response = await fetch(url, { redirect: 'error', headers: { Accept: 'image/png,image/jpeg,image/webp' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type')?.split(';')[0];
  assert(['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(type), `Unexpected content type ${type}`);
  assert(Number(response.headers.get('content-length') ?? 0) <= 1_000_000, 'Oversized logo');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; assert(size <= 1_000_000, 'Oversized logo'); chunks.push(chunk); }
  const sourceBytes = Buffer.concat(chunks);
  const bytes = type.includes('icon') ? await decodeOfficialIcon(sourceBytes) : sourceBytes;
  const metadata = await sharp(bytes, { limitInputPixels: 16_777_216 }).metadata();
  assert(['png', 'jpeg', 'webp'].includes(metadata.format) && metadata.width >= 16 && metadata.height >= 16 && metadata.width <= 4096 && metadata.height <= 4096 && (metadata.pages ?? 1) === 1, 'Invalid static logo image');
  let background = '#ffffff';
  const render = async () => normalizeArtwork(await sharp(bytes).flatten({ background }).resize(96, 96, { fit: 'contain', background }).png().toBuffer());
  let webp = await render(), stats = await sharp(webp).stats();
  // Some official marks are supplied as white artwork on transparent pixels.
  // Retain that exact artwork and its colors, on the desk's dark green backdrop.
  if (!stats.channels.some(channel => channel.stdev > 3) && metadata.hasAlpha) {
    const sourceStats = await sharp(bytes).stats();
    if (sourceStats.channels.at(-1).stdev > 3) {
      background = '#173e2e';
      webp = await render(); stats = await sharp(webp).stats();
    }
  }
  assert(stats.channels.some(channel => channel.stdev > 3), 'Blank or single-color placeholder');
  return { webp, type, background, originalWidth: metadata.width, originalHeight: metadata.height, sourceHash: hash(sourceBytes), imageHash: hash(webp) };
}

// Unknown symbols must fail instead of silently returning a provider placeholder.
const unknown = await fetch('https://financialmodelingprep.com/image-stock/NONEXISTENTSTOCKXYZ.png', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
assert(unknown.status === 404, 'Provider missing-logo behavior changed; inspect before bulk download');
await unknown.body?.cancel();
let cursor = 0;
async function worker() {
  while (cursor < instruments.length) {
    const asset = instruments[cursor++];
    assert(/^[A-Z0-9][A-Z0-9.-]*$/.test(asset.id), 'Unsafe catalog file name');
    const sourceUrl = overrides[asset.id] ?? `https://financialmodelingprep.com/image-stock/${encodeURIComponent(asset.id)}.png`;
    const src = `/placard/stocks/logos/${asset.id.toLowerCase()}.webp`;
    const localPath = path.join('public', src);
    try {
      if (write && !force && previous[asset.id]?.src === src && previous[asset.id]?.sourceUrl === sourceUrl) {
        try {
          const bytes = await readFile(localPath), metadata = await sharp(bytes).metadata();
          assert(metadata.format === 'webp' && metadata.width === 96 && metadata.height === 96, 'Invalid cached logo');
          records.push({ id: asset.id, src, sourceUrl, imageHash: hash(bytes), cached: true, bytes: bytes.length });
          continue;
        } catch { /* Re-download a missing or invalid local image. */ }
      }
      const result = await download(sourceUrl);
      // Keep the full batch in staging until duplicate placeholder checks pass.
      const stage = `output/stock-logo-probes/${asset.id}.webp`;
      await writeFile(stage, result.webp);
      const { webp, ...metadata } = result;
      records.push({ id: asset.id, src, sourceUrl, stage, ...metadata, bytes: webp.length });
    } catch (error) {
      records.push({ id: asset.id, sourceUrl, error: error.message });
    }
    if (records.length % 50 === 0) console.log(`Checked ${records.length}/${instruments.length} company logos`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
const groups = new Map();
for (const record of records.filter(record => !record.error)) groups.set(record.imageHash, [...(groups.get(record.imageHash) ?? []), record.id]);
const duplicates = [...groups.values()].filter(ids => ids.length > 1);
const legitimateDuplicates = new Set(['GOOG,GOOGL', 'FOX,FOXA', 'NWS,NWSA']);
const suspicious = duplicates.filter(ids => !legitimateDuplicates.has([...ids].sort().join(',')));
for (const ids of suspicious) for (const record of records.filter(record => ids.includes(record.id))) record.error = `Shared image requires identity review: ${ids.join(', ')}`;
const valid = records.filter(record => !record.error);
if (write) {
  // Preserve reviewed entries, including retired companies or separately sourced indices.
  const manifest = { ...previous };
  for (const record of valid) {
    if (!record.cached) await writeFile(path.join('public', record.src), await readFile(record.stage));
    manifest[record.id] = { src: record.src, sourceUrl: record.sourceUrl };
  }
  await writeFile(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
}
const report = { checkedAt: new Date().toISOString(), sourceDocumentation: 'https://site.financialmodelingprep.com/developer/docs/company-image-api', written: write, checked: instruments.length, valid: valid.length, duplicates, unavailable: records.filter(record => record.error), records };
await writeFile('output/stock-logo-probes/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checked: report.checked, valid: report.valid, duplicates, unavailable: report.unavailable, written: write }, null, 2));
if (report.unavailable.length) process.exitCode = 1;
