// Rebuild the local stock universe from primary public sources. No application
// credentials or player accounts are read. --write validates every Yahoo symbol
// before replacing the reviewed catalog; without it, only a summary is printed.
import assert from 'node:assert/strict';
import { createDecipheriv, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EURONEXT = 'https://live.euronext.com';
const CAC_URL = `${EURONEXT}/en/product/indices/FR0003500008-XPAR`;
const CAC_COMPOSITION_URL = `${EURONEXT}/en/ajax/getIndexComposition/FR0003500008-XPAR`;
const IVV_URL = 'https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv';
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/csv,text/html' };
const suffixes = { XPAR: '.PA', XAMS: '.AS' };

async function request(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Source unavailable: ${new URL(url).hostname} HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 3_000_000) throw new Error('Source response exceeds the catalog size limit');
  return body;
}

function drupalSettings(html) {
  const script = /<script\b(?=[^>]*data-drupal-selector=["']drupal-settings-json["'])[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  assert(script, 'Euronext public page settings are missing');
  return JSON.parse(script[1]);
}

function publicComposition(envelope, publicPageKey) {
  // Euronext's public page sends this AES JSON transport and its decoding key to
  // every visitor. Decode exactly that displayed table; no authenticated feed.
  assert(typeof publicPageKey === 'string' && publicPageKey.length > 0);
  assert(typeof envelope.ct === 'string' && /^[a-f0-9]{32}$/i.test(envelope.iv) && /^[a-f0-9]{16}$/i.test(envelope.s));
  let material = Buffer.alloc(0), digest = Buffer.alloc(0);
  while (material.length < 48) {
    digest = createHash('md5').update(Buffer.concat([digest, Buffer.from(publicPageKey), Buffer.from(envelope.s, 'hex')])).digest();
    material = Buffer.concat([material, digest]);
  }
  const decipher = createDecipheriv('aes-256-cbc', material.subarray(0, 32), Buffer.from(envelope.iv, 'hex'));
  const decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]).toString('utf8'));
  assert(typeof decoded === 'string');
  return decoded;
}

function text(value) {
  return value.replace(/<[^>]+>/g, '').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
    return named[entity.toLowerCase()] ?? String.fromCodePoint(Number(entity.startsWith('&#x') ? `0x${entity.slice(3, -1)}` : entity.slice(2, -1)));
  }).trim();
}

function csvRows(csv) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  assert(!quoted, 'Truncated holdings CSV');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

async function mapLimit(values, limit, fn) {
  const output = new Array(values.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) { const index = cursor++; output[index] = await fn(values[index], index); }
  }));
  return output;
}

async function cac40() {
  const page = await request(CAC_URL);
  const settings = drupalSettings(page);
  const html = publicComposition(JSON.parse(await request(CAC_COMPOSITION_URL)), settings.ajax_secure?.kye);
  const matches = [...html.matchAll(/<a\b[^>]*href="(\/en\/product\/equities\/([A-Z0-9]{12})-(X[A-Z]{3}))"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(matches.length, 40, 'Never overwrite the CAC40 universe with a partial source');
  assert.equal(new Set(matches.map(match => match[2])).size, 40);
  const asOf = /id="indexCompositionDate"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(html);
  assert(asOf, 'CAC40 composition date is missing');
  const instruments = await mapLimit(matches, 4, async ([, path, isin, mic, name]) => {
    assert(suffixes[mic], `Unsupported CAC40 exchange: ${mic}`);
    const instrument = drupalSettings(await request(`${EURONEXT}${path}`)).custom?.instrument;
    assert(instrument?.isin === isin && instrument?.mic === mic && instrument?.type === 'STOCK', `Wrong Euronext instrument for ${isin}`);
    assert(/^[A-Z0-9]{1,12}$/.test(instrument.symbol), `Unknown Euronext symbol: ${instrument.symbol}`);
    return { id: `${instrument.symbol}${suffixes[mic]}`, symbol: instrument.symbol, name: text(name), kind: 'stock', markets: ['cac40'], currency: 'EUR' };
  });
  return { asOf: `${asOf[3]}-${asOf[2]}-${asOf[1]}`, instruments };
}

async function sp500() {
  const rows = csvRows(await request(IVV_URL));
  const date = rows.find(row => row[0] === 'Fund Holdings as of')?.[1];
  assert(date && Number.isFinite(Date.parse(date)), 'IVV holdings date is missing');
  const header = rows.findIndex(row => row[0] === 'Ticker' && row.includes('Asset Class'));
  assert(header >= 0, 'IVV returned a web page instead of the holdings CSV');
  const columns = rows[header];
  const holdings = rows.slice(header + 1).map(row => Object.fromEntries(columns.map((name, index) => [name, row[index] ?? ''])));
  const equities = holdings.filter(row => row['Asset Class'] === 'Equity');
  const excluded = equities.filter(row => !['NASDAQ', 'NYSE', 'NYSE Arca', 'Cboe BZX'].includes(row.Exchange));
  const listed = equities.filter(row => ['NASDAQ', 'NYSE', 'NYSE Arca', 'Cboe BZX'].includes(row.Exchange));
  assert(listed.length >= 490 && listed.length <= 515, 'Unexpected IVV listed-equity coverage');
  const instruments = listed.map(row => {
    assert.equal(row.Currency, 'USD', `Unexpected IVV valuation currency for ${row.Ticker}`);
    assert.equal(row['Market Currency'], 'USD', `Unexpected listing currency for ${row.Ticker}`);
    const id = row.Ticker.trim().replace(/[. ]/g, '-');
    assert(/^[A-Z][A-Z0-9-]{0,11}$/.test(id), `Unknown IVV ticker: ${row.Ticker}`);
    return { id, symbol: id, name: row.Name.trim(), kind: 'stock', markets: ['sp500'], currency: 'USD' };
  });
  assert.equal(new Set(instruments.map(asset => asset.id)).size, instruments.length);
  // Holdings are labelled by a calendar date, not local midnight in the machine's
  // time zone. Preserve that date on Europe/Paris and UTC build machines alike.
  return { asOf: new Date(`${date} UTC`).toISOString().slice(0, 10), instruments, excluded: excluded.map(row => ({ symbol: row.Ticker, name: row.Name, exchange: row.Exchange })) };
}

async function verifyQuotes(instruments) {
  const verified = new Map(); const batches = [];
  for (let offset = 0; offset < instruments.length; offset += 20) batches.push(instruments.slice(offset, offset + 20));
  await mapLimit(batches, 2, async batch => {
    const url = new URL('https://query1.finance.yahoo.com/v7/finance/spark');
    url.search = new URLSearchParams({ symbols: batch.map(asset => asset.id).join(','), range: '1d', interval: '1m' }).toString();
    const response = JSON.parse(await request(url));
    assert.equal(response.spark?.error, null, 'Yahoo spark provider error');
    assert(Array.isArray(response.spark.result));
    for (const asset of batch) {
      const result = response.spark.result.find(item => item.symbol === asset.id);
      const meta = result?.response?.[0]?.meta;
      assert(meta?.symbol === asset.id, `Yahoo did not return ${asset.id}`);
      assert.equal(meta.currency, asset.currency, `Wrong currency for ${asset.id}`);
      assert.equal(meta.instrumentType, asset.kind === 'index' ? 'INDEX' : 'EQUITY', `Wrong instrument type for ${asset.id}`);
      assert(Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0, `Missing real price for ${asset.id}`);
      assert(Number.isSafeInteger(meta.regularMarketTime) && meta.regularMarketTime > 0, `Missing quote timestamp for ${asset.id}`);
      assert(meta.currentTradingPeriod?.regular?.start < meta.currentTradingPeriod?.regular?.end, `Missing trading session for ${asset.id}`);
      verified.set(asset.id, result);
    }
  });
  assert.equal(verified.size, instruments.length);
  const samples = ['^FCHI', '^GSPC', 'AAPL', 'AIR.PA'].map(id => verified.get(id)).filter(Boolean);
  const fxUrl = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=EURUSD%3DX&range=1d&interval=1m';
  const fx = JSON.parse(await request(fxUrl));
  assert.equal(fx.spark?.result?.[0]?.response?.[0]?.meta?.symbol, 'EURUSD=X');
  samples.push(fx.spark.result[0]);
  await mkdir(resolve('output'), { recursive: true });
  await writeFile(resolve('output/stock-market-source-check.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), provider: 'Yahoo Finance public spark', validatedInstruments: verified.size, spark: { result: samples, error: null } }, null, 2)}\n`);
  return verified.size;
}

try {
  const [cac, sp] = await Promise.all([cac40(), sp500()]);
  const instruments = [
    { id: '^FCHI', symbol: '^FCHI', name: 'CAC 40', kind: 'index', markets: ['cac40'], currency: 'EUR' },
    { id: '^GSPC', symbol: '^GSPC', name: 'S&P 500', kind: 'index', markets: ['sp500'], currency: 'USD' },
    ...cac.instruments.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    ...sp.instruments.sort((a, b) => a.symbol.localeCompare(b.symbol, 'en')),
  ];
  assert.equal(new Set(instruments.map(asset => asset.id)).size, instruments.length);
  const previous = await readFile(resolve('src/lib/stock-market-catalog.json'), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const liveIds = new Set(instruments.map(asset => asset.id));
  assert(previous === null || Array.isArray(previous.instruments), 'Existing catalog structure is invalid');
  const retired = (previous?.instruments ?? []).filter(asset => !liveIds.has(asset.id)).map(asset => {
    assert(typeof asset.id === 'string' && typeof asset.symbol === 'string' && typeof asset.name === 'string'
      && ['stock', 'index'].includes(asset.kind) && ['EUR', 'USD'].includes(asset.currency), 'Existing instrument metadata is invalid');
    return { ...asset, markets: [] };
  });
  // A former constituent may still belong to a player's portfolio. Keep its
  // identity for valuations and sales; only current members accept new buys.
  const catalog = { asOf: new Date().toISOString(), sources: [
    { name: 'Euronext CAC 40 official composition', url: CAC_URL, compositionUrl: CAC_COMPOSITION_URL, asOf: cac.asOf, type: 'index-constituents' },
    { name: 'iShares Core S&P 500 ETF (IVV) listed equity holdings', url: IVV_URL, asOf: sp.asOf, type: 'tracking-fund-holdings', note: 'S&P 500 universe inferred from listed equity holdings of its tracking ETF. Cash, futures and unlisted residual holdings are excluded.', excluded: sp.excluded },
  ], instruments: [...instruments, ...retired.sort((a, b) => a.id.localeCompare(b.id, 'en'))] };
  const write = process.argv.includes('--write');
  const verified = write || process.argv.includes('--verify-quotes') ? await verifyQuotes(instruments) : null;
  if (write) await writeFile(resolve('src/lib/stock-market-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ total: catalog.instruments.length, current: instruments.length, retired: retired.length, cac40: cac.instruments.length, sp500: sp.instruments.length, indices: 2, dates: { cac40: cac.asOf, sp500: sp.asOf }, excluded: sp.excluded, verifiedYahooSymbols: verified, written: write }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : 'Stock catalog refresh failed'); process.exitCode = 1; }
