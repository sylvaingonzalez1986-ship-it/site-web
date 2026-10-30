// Register generated hairstyle edits to the approved face without redrawing artwork.
// Keep the full transparent frame; never trim individual hairstyles.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const SIZE = 768;
const source = 'output/imagegen/chanvrier-v6/source';
const target = 'public/contest/avatars/chanvrier-v6';
const names = ['bald', 'quiff', 'bob', 'long', 'curls', 'afro', 'braids', 'bun', 'ponytail', 'mohawk', 'buzz'];
const pixels = async name => sharp(`${source}/head-${name}.png`).resize(SIZE, SIZE, { fit: 'fill' }).ensureAlpha().raw().toBuffer();

function landmarks(data) {
  const mask = new Uint8Array(SIZE * SIZE), seen = new Uint8Array(mask.length), glints = [];
  for (let y = 295; y < 465; y++) for (let x = 350; x < 610; x++) {
    const p = y * SIZE + x, i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (data[i + 3] > 245 && r > 225 && g > 225 && b > 195 && r - b < 40) mask[p] = 1;
  }
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || seen[p]) continue;
    const group = [p]; seen[p] = 1;
    let sx = 0, sy = 0, minx = SIZE, maxx = 0, miny = SIZE, maxy = 0;
    for (let j = 0; j < group.length; j++) {
      const q = group[j], x = q % SIZE, y = Math.floor(q / SIZE);
      sx += x; sy += y; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      for (const n of [q - 1, q + 1, q - SIZE, q + SIZE]) if (n >= 0 && n < mask.length && mask[n] && !seen[n]) { seen[n] = 1; group.push(n); }
    }
    const width = maxx - minx + 1, height = maxy - miny + 1;
    if (group.length >= 25 && group.length <= 80 && width >= 5 && width <= 10 && height >= 5 && height <= 11) glints.push([sx / group.length, sy / group.length]);
  }
  glints.sort((a, b) => a[0] - b[0]);
  if (glints.length !== 2) throw new Error(`Expected two registered eye glints, found ${glints.length}`);
  let sx = 0, sy = 0, count = 0;
  const eyeMidpoint = [(glints[0][0] + glints[1][0]) / 2, (glints[0][1] + glints[1][1]) / 2];
  // Follow the mouth from the eyes. A broad rectangle also catches the ochre
  // reflections in long hair and braids beside the face.
  for (let y = Math.floor(eyeMidpoint[1] + 80); y < Math.ceil(eyeMidpoint[1] + 155); y++) for (let x = Math.floor(eyeMidpoint[0] - 50); x < Math.ceil(eyeMidpoint[0] + 30); x++) {
    const i = (y * SIZE + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (data[i + 3] > 245 && r > 180 && g < 160 && b < 135 && r > g * 1.5 && r > b * 1.5) { sx += x; sy += y; count++; }
  }
  if (count < 100) throw new Error('Expected the original open-smile tongue');
  return [...glints, [sx / count, sy / count]];
}

function similarity(from, to) {
  const mean = points => [0, 1].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
  const f = mean(from), t = mean(to);
  let numeratorA = 0, numeratorB = 0, denominator = 0;
  for (let i = 0; i < from.length; i++) {
    const x = from[i][0] - f[0], y = from[i][1] - f[1], u = to[i][0] - t[0], v = to[i][1] - t[1];
    numeratorA += x * u + y * v; numeratorB += x * v - y * u; denominator += x * x + y * y;
  }
  const a = numeratorA / denominator, b = numeratorB / denominator;
  const tx = t[0] - a * f[0] + b * f[1], ty = t[1] - b * f[0] - a * f[1];
  const residuals = from.map((p, i) => Math.hypot(a * p[0] - b * p[1] + tx - to[i][0], b * p[0] + a * p[1] + ty - to[i][1]));
  return { a, b, tx, ty, scale: Math.hypot(a, b), rotationDegrees: Math.atan2(b, a) * 180 / Math.PI, maxResidual: Math.max(...residuals) };
}

function transform(data, m) {
  const output = Buffer.alloc(SIZE * SIZE * 4), determinant = m.a * m.a + m.b * m.b;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x - m.tx, v = y - m.ty;
    const sourceX = (m.a * u + m.b * v) / determinant, sourceY = (-m.b * u + m.a * v) / determinant;
    const x0 = Math.floor(sourceX), y0 = Math.floor(sourceY), dx = sourceX - x0, dy = sourceY - y0;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= SIZE || y0 + 1 >= SIZE) continue;
    const offsets = [(y0 * SIZE + x0) * 4, (y0 * SIZE + x0 + 1) * 4, ((y0 + 1) * SIZE + x0) * 4, ((y0 + 1) * SIZE + x0 + 1) * 4];
    const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
    let alpha = 0;
    const colors = [0, 0, 0];
    for (let n = 0; n < 4; n++) {
      const weight = weights[n] * data[offsets[n] + 3]; alpha += weight;
      for (let c = 0; c < 3; c++) colors[c] += data[offsets[n] + c] * weight;
    }
    const i = (y * SIZE + x) * 4;
    for (let c = 0; c < 3; c++) output[i + c] = alpha ? Math.round(colors[c] / alpha) : 0;
    output[i + 3] = Math.round(alpha);
  }
  return output;
}

await mkdir(target, { recursive: true });
const master = landmarks(await pixels('crop'));
const report = { frame: [SIZE, SIZE], sourceMaster: `${source}/head-crop.png`, referenceLandmarks: master, method: 'Least-squares uniform scale, rotation and translation from two eye glints and tongue centre; bilinear premultiplied-alpha sampling; no individual trim.', assets: {} };
for (const name of names) {
  const original = await pixels(name), points = landmarks(original), registration = similarity(points, master);
  // Tiny subpixel differences are normal print grain; keep already registered originals untouched.
  const stable = Math.max(...points.map((p, i) => Math.hypot(p[0] - master[i][0], p[1] - master[i][1]))) < 1;
  const applied = stable ? { a: 1, b: 0, tx: 0, ty: 0 } : registration;
  const data = stable ? original : transform(original, applied);
  await sharp(data, { raw: { width: SIZE, height: SIZE, channels: 4 } }).webp({ lossless: true }).toFile(`${target}/head-${name}.webp`);
  report.assets[name] = { source: `${source}/head-${name}.png`, landmarks: points, fitted: registration, applied };
  console.log(name, JSON.stringify({ stable, scale: +registration.scale.toFixed(5), rotation: +registration.rotationDegrees.toFixed(3), tx: +registration.tx.toFixed(2), ty: +registration.ty.toFixed(2), maxResidual: +registration.maxResidual.toFixed(3) }));
}
await writeFile('output/imagegen/chanvrier-v6/hair-registration.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('docs/bete-de-concours/chanvrier-v6-hair-registration.json', JSON.stringify(report, null, 2) + '\n');
