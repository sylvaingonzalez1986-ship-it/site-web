import { CHANVRIER_APPEARANCE_OPTIONS as OPTIONS, CHANVRIER_SKINS, getChanvrierAppearance, type ChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";

type Profile = Pick<ChanvrierProfile, "skin" | "appearance" | "gender">;
type Box = readonly [number, number, number, number];
type Rgb = readonly [number, number, number];
const SIZE = 768;
const SCALE = SIZE / 1254;
const ROOT = "/contest/avatars/sylvain-v4/";
const images = new Map<string, Promise<HTMLImageElement>>();
const rendered = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<HTMLCanvasElement>>();

function load(name: string): Promise<HTMLImageElement> {
  const cached = images.get(name);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { images.delete(name); reject(new Error(`Illustration indisponible : ${name}`)); };
    image.src = `${ROOT}${name}.webp`;
  });
  images.set(name, promise);
  return promise;
}

function canvas() {
  const result = document.createElement("canvas");
  result.width = SIZE;
  result.height = SIZE;
  return result;
}

function pixels(image: CanvasImageSource) {
  const result = canvas();
  const context = result.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, SIZE, SIZE);
  return context.getImageData(0, 0, SIZE, SIZE);
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const x = clamp(value); return x * x * (3 - 2 * x); };
const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const lightness = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;
// Chestnut fill is appreciably more saturated than skin antialiasing around black
// facial ink. A loose hue threshold would incorrectly protect old mouth edges.
const isHair = (r: number, g: number, b: number) => r > 35 && r < 200 && r > g * 1.24 && g > b * 1.17 && b < 135 && r < g * 2.8;

/** Protect the entire inked edge of a hairstyle as well as its brown fill. */
function hairMask(data: Uint8ClampedArray) {
  const mask = new Uint8Array(SIZE * SIZE);
  const colored = new Uint8Array(mask.length);
  const horizontal = new Uint8Array(mask.length);
  const radius = 5;
  for (let i = 0; i < mask.length; i++) {
    const offset = i * 4;
    if (data[offset + 3] > 25 && isHair(data[offset], data[offset + 1], data[offset + 2])) colored[i] = 1;
  }
  // Isolated warm pixels are ink/skin antialiasing, not a strand of chestnut.
  // Seed only continuous colored areas, then expand over their black outline.
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      if (!colored[i]) continue;
      let count = 0;
      for (let row = -1; row <= 1; row++) for (let column = -1; column <= 1; column++) count += colored[i + row * SIZE + column];
      if (count >= 7) mask[i] = 1;
    }
  }
  for (let y = 0; y < SIZE; y++) {
    let count = 0;
    for (let x = -radius; x < SIZE; x++) {
      if (x + radius < SIZE) count += mask[y * SIZE + x + radius];
      if (x - radius - 1 >= 0) count -= mask[y * SIZE + x - radius - 1];
      if (x >= 0) horizontal[y * SIZE + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    let count = 0;
    for (let y = -radius; y < SIZE; y++) {
      if (y + radius < SIZE) count += horizontal[(y + radius) * SIZE + x];
      if (y - radius - 1 >= 0) count -= horizontal[(y - radius - 1) * SIZE + x];
      if (y >= 0) mask[y * SIZE + x] = count > 0 ? 1 : 0;
    }
  }
  return mask;
}

/** All coordinates refer to the same untrimmed 1254 px drawing. */
function patch(target: ImageData, source: ImageData, box: Box, protectedHair: Uint8Array, feather = 8) {
  const [left, top, right, bottom] = box.map(value => value * SCALE);
  const edge = feather * SCALE;
  for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
    for (let x = Math.floor(left); x < Math.ceil(right); x++) {
      const pixel = y * SIZE + x;
      if (protectedHair[pixel]) continue;
      const i = pixel * 4;
      const fade = smooth(Math.min(x - left, right - x, y - top, bottom - y) / edge);
      const alpha = source.data[i + 3] / 255 * fade;
      if (!alpha) continue;
      const under = target.data[i + 3] / 255;
      const output = alpha + under * (1 - alpha);
      for (let channel = 0; channel < 3; channel++) target.data[i + channel] = (source.data[i + channel] * alpha + target.data[i + channel] * under * (1 - alpha)) / output;
      target.data[i + 3] = output * 255;
    }
  }
}

/** Extract the new black frame against the unchanged master. Transparent lenses
 * retain the selected brows, eyes and nose rather than resetting those choices. */
function glassesPatch(target: ImageData, source: ImageData, master: ImageData, protectedHair: Uint8Array) {
  for (let y = Math.floor(515 * SCALE); y < Math.ceil(750 * SCALE); y++) {
    for (let x = Math.floor(415 * SCALE); x < Math.ceil(915 * SCALE); x++) {
      const pixel = y * SIZE + x, i = pixel * 4;
      if (protectedHair[pixel] || source.data[i + 3] < 25) continue;
      const base = lightness(master.data[i], master.data[i + 1], master.data[i + 2]);
      const ink = lightness(source.data[i], source.data[i + 1], source.data[i + 2]);
      if (base < 55 || base - ink < 25) continue;
      const coverage = clamp((base - ink) / base);
      for (let channel = 0; channel < 3; channel++) target.data[i + channel] *= 1 - coverage;
    }
  }
}

/** Bilinear sampling uses premultiplied alpha, preserving clean transparent edges. */
function sample(source: Uint8ClampedArray, output: Uint8ClampedArray, index: number, x: number, y: number) {
  const px = clamp(x, 0, SIZE - 1.001), py = clamp(y, 0, SIZE - 1.001);
  const x0 = Math.floor(px), y0 = Math.floor(py), dx = px - x0, dy = py - y0;
  const offsets = [(y0 * SIZE + x0) * 4, (y0 * SIZE + x0 + 1) * 4, ((y0 + 1) * SIZE + x0) * 4, ((y0 + 1) * SIZE + x0 + 1) * 4];
  const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
  let alpha = 0, red = 0, green = 0, blue = 0;
  for (let i = 0; i < 4; i++) {
    const weight = weights[i] * source[offsets[i] + 3];
    alpha += weight;
    red += source[offsets[i]] * weight;
    green += source[offsets[i] + 1] * weight;
    blue += source[offsets[i] + 2] * weight;
  }
  output[index] = alpha ? red / alpha : 0;
  output[index + 1] = alpha ? green / alpha : 0;
  output[index + 2] = alpha ? blue / alpha : 0;
  output[index + 3] = alpha;
}

/** Deform a feature together with the surrounding skin; no detached feature sprites. */
function featureWarp(image: ImageData, center: readonly [number, number], radius: readonly [number, number], scale: readonly [number, number], protectedHair: Uint8Array) {
  const [cx, cy] = center.map(value => value * SCALE);
  const [rx, ry] = radius.map(value => value * SCALE);
  const source = new Uint8ClampedArray(image.data);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const index = y * SIZE + x;
      if (protectedHair[index]) continue;
      const distance = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (distance >= 1) continue;
      const influence = 1 - smooth((distance - .42) / .58);
      const sourceX = cx + (x - cx) / (1 + (scale[0] - 1) * influence);
      const sourceY = cy + (y - cy) / (1 + (scale[1] - 1) * influence);
      if (protectedHair[Math.round(sourceY) * SIZE + Math.round(sourceX)]) continue;
      sample(source, image.data, index * 4, sourceX, sourceY);
    }
  }
}

function faceWarp(image: ImageData, face: ChanvrierAppearance["face"], protectedHair: Uint8Array) {
  if (face === "oval") return;
  const source = new Uint8ClampedArray(image.data);
  const distance = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < distance.length; i++) distance[i] = protectedHair[i] ? 0 : 16;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x;
    distance[i] = Math.min(distance[i], x ? distance[i - 1] + 1 : 16, y ? distance[i - SIZE] + 1 : 16);
  }
  for (let y = SIZE - 1; y >= 0; y--) for (let x = SIZE - 1; x >= 0; x--) {
    const i = y * SIZE + x;
    distance[i] = Math.min(distance[i], x < SIZE - 1 ? distance[i + 1] + 1 : 16, y < SIZE - 1 ? distance[i + SIZE] + 1 : 16);
  }
  // Only the lower right cheek and jaw move. The scalp, ear and eyes never move.
  for (let y = Math.floor(710 * SCALE); y < Math.ceil(1030 * SCALE); y++) {
    const masterY = y / SCALE;
    const verticalWeight = Math.sin(Math.PI * clamp((masterY - 710) / 320));
    const jaw = smooth((masterY - 760) / 160);
    for (let x = Math.floor(515 * SCALE); x < Math.ceil(1010 * SCALE); x++) {
      const pixel = y * SIZE + x;
      if (protectedHair[pixel]) continue;
      const masterX = x / SCALE;
      // Let the displacement fade into a lock of hair, avoiding a hard seam
      // where a longer hairstyle overlaps the moving jaw outline.
      const weight = verticalWeight * smooth((masterX - 515) / 90) * (1 - smooth((masterX - 965) / 45)) * smooth(distance[pixel] / 12);
      let width = 0, height = 0;
      if (face === "round") width = .07;
      else if (face === "square") width = .075 * jaw;
      else if (face === "heart") width = -.08 * jaw;
      else if (face === "long") { width = -.035; height = .06; }
      else if (face === "angular") width = .035 - .11 * jaw;
      const sourceX = (735 + (masterX - 735) / (1 + width * weight)) * SCALE;
      const sourceY = (710 + (masterY - 710) / (1 + height * weight)) * SCALE;
      if (protectedHair[Math.round(sourceY) * SIZE + Math.round(sourceX)]) continue;
      sample(source, image.data, pixel * 4, sourceX, sourceY);
    }
  }
}

function recolor(image: ImageData, skinHex: string, hairHex: string, eyesHex: string) {
  const skin = rgb(skinHex), hair = rgb(hairHex), eyes = rgb(eyesHex);
  const source = new Uint8ClampedArray(image.data);
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] < 8) continue;
    const r = source[i], g = source[i + 1], b = source[i + 2], light = lightness(r, g, b);
    let target: Rgb | undefined, shade = 1;
    if (isHair(r, g, b)) { target = hair; shade = clamp(light / 73, .3, 1.35); }
    else if (r > g * 1.018 && g > b * 1.01 && b > 105 && light > 125) { target = skin; shade = clamp(light / 231, .55, 1.12); }
    if (target) for (let channel = 0; channel < 3; channel++) image.data[i + channel] = Math.min(255, target[channel] * shade);
  }
  // Keep the black outer ink and cream glints of Sylvain's vertical eyes.
  for (const [cx, cy, rx, ry] of [[682, 651, 40, 61], [809, 613, 40, 61]]) {
    for (let y = Math.floor((cy - ry) * SCALE); y < Math.ceil((cy + ry) * SCALE); y++) {
      for (let x = Math.floor((cx - rx) * SCALE); x < Math.ceil((cx + rx) * SCALE); x++) {
        const i = (y * SIZE + x) * 4;
        if (Math.hypot((x / SCALE - cx) / rx, (y / SCALE - cy) / ry) > 1 || source[i + 3] < 245) continue;
        const interior = [i, i - 8, i + 8, i - SIZE * 8, i + SIZE * 8].every(offset => source[offset + 3] > 245 && lightness(source[offset], source[offset + 1], source[offset + 2]) < 40);
        if (interior) for (let channel = 0; channel < 3; channel++) image.data[i + channel] = eyes[channel] * .43;
      }
    }
  }
}

async function render(profile: Profile): Promise<HTMLCanvasElement> {
  const appearance = getChanvrierAppearance(profile);
  const glasses = appearance.accessory === "glasses" || appearance.accessory === "round-glasses";
  const names = [`head-${appearance.hair}`];
  if (appearance.mouth !== "grin") names.push(`patch-mouth-${appearance.mouth}`);
  if (appearance.eyebrows !== "natural") names.push(`patch-eyebrows-${appearance.eyebrows}`);
  if (appearance.facialHair !== "none") names.push(`patch-facialHair-${appearance.facialHair}`, "head-bald");
  if (glasses) names.push(`patch-accessory-${appearance.accessory}`, "head-bald");
  const sources = await Promise.all([...new Set(names)].map(async name => [name, pixels(await load(name))] as const));
  const parts = new Map(sources);
  const result = new ImageData(new Uint8ClampedArray(parts.get(`head-${appearance.hair}`)!.data), SIZE, SIZE);
  const protectedHair = appearance.hair === "bald" ? new Uint8Array(SIZE * SIZE) : hairMask(result.data);
  const facialHair = appearance.facialHair;
  if (facialHair !== "none") {
    patch(result, parts.get(`patch-facialHair-${facialHair}`)!, facialHair === "moustache" ? [625, 707, 900, 820] : [300, 635, 980, 1050], protectedHair);
  }
  if (appearance.eyebrows !== "natural") patch(result, parts.get(`patch-eyebrows-${appearance.eyebrows}`)!, [600, 475, 865, 595], protectedHair);
  if (appearance.mouth !== "grin" || facialHair !== "none") {
    const mouth = parts.get(appearance.mouth === "grin" ? "head-bald" : `patch-mouth-${appearance.mouth}`)!;
    // The new facial hair and its ink stay above every expression. Replace the
    // entire old mouth, including its upper lip, without painting over the beard.
    const protectedFacialHair = facialHair === "none" ? protectedHair : hairMask(result.data);
    patch(result, mouth, [640, 730, 885, 884], protectedFacialHair);
  }
  if (appearance.eyes !== "almond") {
    const scale: readonly [number, number] = appearance.eyes === "round" ? [1.15, .9] : appearance.eyes === "relaxed" ? [1.01, .83] : [1.12, 1.12];
    featureWarp(result, [682, 651], [73, 99], scale, protectedHair);
    featureWarp(result, [809, 613], [70, 95], scale, protectedHair);
  }
  if (appearance.nose !== "small") featureWarp(result, [795, 704], [65, 53], appearance.nose === "round" ? [1.08, 1.1] : [1.19, .95], protectedHair);
  faceWarp(result, appearance.face, protectedHair);
  if (glasses) glassesPatch(result, parts.get(`patch-accessory-${appearance.accessory}`)!, parts.get("head-bald")!, protectedHair);
  recolor(result, CHANVRIER_SKINS.find(option => option.code === profile.skin)!.color, OPTIONS.hairColor.find(option => option.code === appearance.hairColor)!.color, OPTIONS.eyeColor.find(option => option.code === appearance.eyeColor)!.color);
  const output = canvas();
  output.getContext("2d")!.putImageData(result, 0, 0);
  return output;
}

/** Every haircut is a complete illustration in one shared frame, never a loose wig. */
export function renderChanvrierHead(profile: Profile): Promise<HTMLCanvasElement> {
  const a = getChanvrierAppearance(profile);
  const key = JSON.stringify([profile.skin, a.hair, a.hairColor, a.face, a.eyes, a.eyeColor, a.eyebrows, a.nose, a.mouth, a.facialHair, a.accessory]);
  const cached = rendered.get(key);
  if (cached) {
    rendered.delete(key);
    rendered.set(key, cached);
    return Promise.resolve(cached);
  }
  const active = pending.get(key);
  if (active) return active;
  const promise = render(profile).then(result => {
    if (rendered.size >= 32) rendered.delete(rendered.keys().next().value!);
    rendered.set(key, result);
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
