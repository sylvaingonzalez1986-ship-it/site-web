import { CHANVRIER_APPEARANCE_OPTIONS as OPTIONS, CHANVRIER_SKINS, getChanvrierAppearance, type ChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { CHANVRIER_HEAD_REGISTRATION as REGISTRATION } from "./chanvrier-head-registration";

type Profile = Pick<ChanvrierProfile, "skin" | "appearance" | "gender">;
type Box = readonly [number, number, number, number];
type Rgb = readonly [number, number, number];
const SIZE = REGISTRATION.frameSize;
const SCALE = SIZE / REGISTRATION.masterSize;
const ROOT = "/contest/avatars/chanvrier-v6/";
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
// The painted chestnut has both deep umber strands and copper highlights. Keep
// warm skin, the coral tongue and dark antialiasing out of that colour range.
const isHair = (r: number, g: number, b: number) => r > 30 && r < 242 && r > g * 1.3 && g > b * 1.15 && b < 150 && r < g * 2.8;
const EYE_BOXES: readonly Box[] = REGISTRATION.eyes;
const inEyes = (x: number, y: number) => EYE_BOXES.some(([left, top, right, bottom]) => x >= left * SCALE && x <= right * SCALE && y >= top * SCALE && y <= bottom * SCALE);
const inMouth = (x: number, y: number) => x >= REGISTRATION.mouth[0] * SCALE && x <= REGISTRATION.mouth[2] * SCALE && y >= REGISTRATION.mouth[1] * SCALE && y <= REGISTRATION.mouth[3] * SCALE;
const isTongue = (r: number, g: number, b: number, x: number, y: number) => inMouth(x, y) && r > 100 && r > g * 1.85 && b > g * .5;
const isNeutral = (r: number, g: number, b: number) => r < g * 1.055 && g < b * 1.16;

/** Separate actual eye whites / teeth from isolated pale pixels at ink edges.
 * Keeping every pale edge would leave an ivory outline on darker skin tones. */
function creamMask(source: Uint8ClampedArray) {
  const candidates = new Uint8Array(SIZE * SIZE);
  const mask = new Uint8Array(candidates.length);
  for (const box of [...EYE_BOXES, REGISTRATION.mouth]) {
    const [left, top, right, bottom] = box.map(value => Math.round(value * SCALE));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const pixel = y * SIZE + x, i = pixel * 4;
      const r = source[i], g = source[i + 1], b = source[i + 2];
      if (source[i + 3] > 25 && r > 180 && g > 180 && b > 170 && isNeutral(r, g, b)) candidates[pixel] = 1;
    }
  }
  for (let pixel = 0; pixel < candidates.length; pixel++) {
    if (!candidates[pixel]) continue;
    const component = [pixel];
    candidates[pixel] = 0;
    for (let cursor = 0; cursor < component.length; cursor++) {
      const current = component[cursor];
      for (const next of [current - 1, current + 1, current - SIZE, current + SIZE]) {
        if (!candidates[next]) continue;
        candidates[next] = 0;
        component.push(next);
      }
    }
    const minimum = inEyes(pixel % SIZE, Math.floor(pixel / SIZE)) ? 8 : 32;
    if (component.length >= minimum) for (const index of component) mask[index] = 1;
  }
  return mask;
}

/** Protect the entire inked edge of a hairstyle as well as its brown fill. */
function hairMask(data: Uint8ClampedArray) {
  const mask = new Uint8Array(SIZE * SIZE);
  const colored = new Uint8Array(mask.length);
  const horizontal = new Uint8Array(mask.length);
  const radius = 5;
  for (let i = 0; i < mask.length; i++) {
    const offset = i * 4;
    // Brown irises are part of the face, never protected locks of hair.
    const x = i % SIZE, y = Math.floor(i / SIZE);
    if (data[offset + 3] > 25 && !inEyes(x, y) && !isTongue(data[offset], data[offset + 1], data[offset + 2], x, y) && isHair(data[offset], data[offset + 1], data[offset + 2])) colored[i] = 1;
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
function patch(target: ImageData, source: ImageData, box: Box, protectedHair: Uint8Array, feather = 8, replaceContour = false, paintedRegion?: Uint8Array) {
  const [left, top, right, bottom] = box.map(value => value * SCALE);
  const edge = feather * SCALE;
  for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
    for (let x = Math.floor(left); x < Math.ceil(right); x++) {
      const pixel = y * SIZE + x;
      if (protectedHair[pixel] || (paintedRegion && !paintedRegion[pixel])) continue;
      const i = pixel * 4;
      const fade = smooth(Math.min(x - left, right - x, y - top, bottom - y) / edge);
      const alpha = source.data[i + 3] / 255 * fade;
      if (!alpha && !replaceContour) continue;
      const under = target.data[i + 3] / 255;
      // A full beard supplies its own jaw outline. Crossfade that complete
      // contour, including alpha, so the old cheek ink cannot remain beside it.
      const remaining = under * (1 - (replaceContour ? fade : alpha));
      const output = alpha + remaining;
      for (let channel = 0; channel < 3; channel++) target.data[i + channel] = output ? (source.data[i + channel] * alpha + target.data[i + channel] * remaining) / output : 0;
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

/** Resample only one eye's registered tile. Sampling outside the tile used to
 * pull the neighbouring nose into flattened eyes. Its skin border blends the edit. */
function eyeWarp(image: ImageData, box: Box, center: readonly [number, number], scale: readonly [number, number], protectedHair: Uint8Array) {
  const [left, top, right, bottom] = box.map(value => value * SCALE);
  const [cx, cy] = center.map(value => value * SCALE);
  const source = new Uint8ClampedArray(image.data);
  for (let y = Math.ceil(top); y < Math.floor(bottom); y++) {
    for (let x = Math.ceil(left); x < Math.floor(right); x++) {
      const index = y * SIZE + x;
      if (protectedHair[index]) continue;
      const fade = smooth(Math.min(x - left, right - x, y - top, bottom - y) / (8 * SCALE));
      const sourceX = x + (clamp(cx + (x - cx) / scale[0], left + 1, right - 1) - x) * fade;
      const sourceY = y + (clamp(cy + (y - cy) / scale[1], top + 1, bottom - 1) - y) * fade;
      if (protectedHair[Math.round(sourceY) * SIZE + Math.round(sourceX)]) continue;
      sample(source, image.data, index * 4, sourceX, sourceY);
    }
  }
}

function protectBrows(image: ImageData, protectedHair: Uint8Array) {
  const mask = new Uint8Array(protectedHair);
  for (const box of REGISTRATION.brows) {
    const [left, top, right, bottom] = box.map(value => Math.round(value * SCALE));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const pixel = y * SIZE + x, offset = pixel * 4;
      if (lightness(image.data[offset], image.data[offset + 1], image.data[offset + 2]) >= 100) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mask[pixel + dy * SIZE + dx] = 1;
    }
  }
  return mask;
}

// Horizontal offsets in the master frame. The last landmark is the common chin:
// face choices change the jaw, never its attachment to the collar or the features.
const JAW_ROWS = [620, 680, 740, 800, 850, 885, 915, 938] as const;
const JAW_OFFSETS: Record<ChanvrierAppearance["face"], readonly number[]> = {
  oval: [0, 0, -2, -6, -10, -8, -4, 0],
  round: [0, 2, 10, 18, 24, 20, 12, 0],
  square: [0, 2, 8, 22, 36, 38, 24, 0],
  heart: [0, 6, 8, -6, -26, -26, -14, 0],
  long: [0, -4, -14, -26, -32, -24, -12, 0],
  angular: [0, 4, 15, 9, -6, -10, -5, 0],
  pear: [0, -3, -5, 5, 21, 28, 16, 0],
  cheeked: [0, 12, 20, 8, -14, -17, -7, 0],
};

function jawOffset(face: ChanvrierAppearance["face"], y: number) {
  if (y <= JAW_ROWS[0] || y >= JAW_ROWS[JAW_ROWS.length - 1]) return 0;
  const next = JAW_ROWS.findIndex(row => row > y);
  const amount = smooth((y - JAW_ROWS[next - 1]) / (JAW_ROWS[next] - JAW_ROWS[next - 1]));
  const offsets = JAW_OFFSETS[face];
  return offsets[next - 1] + (offsets[next] - offsets[next - 1]) * amount;
}

function faceWarp(image: ImageData, master: ImageData, face: ChanvrierAppearance["face"], protectedHair: Uint8Array) {
  const source = new Uint8ClampedArray(image.data);
  const distance = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < distance.length; i++) distance[i] = protectedHair[i] ? 0 : 96;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x;
    distance[i] = Math.min(distance[i], x ? distance[i - 1] + 1 : 96, y ? distance[i - SIZE] + 1 : 96);
  }
  for (let y = SIZE - 1; y >= 0; y--) for (let x = SIZE - 1; x >= 0; x--) {
    const i = y * SIZE + x;
    distance[i] = Math.min(distance[i], x < SIZE - 1 ? distance[i + 1] + 1 : 96, y < SIZE - 1 ? distance[i + SIZE] + 1 : 96);
  }
  // Follow the actual inked bald master. A theoretical ellipse overestimated
  // its lower cheek and made pinched temples and oversized, empty square chins.
  for (let y = Math.floor(JAW_ROWS[0] * SCALE); y < Math.ceil(938 * SCALE); y++) {
    const masterY = y / SCALE;
    let first: number = SIZE, last = -1;
    for (let x = Math.floor(300 * SCALE); x < Math.ceil(1000 * SCALE); x++) {
      if (master.data[(y * SIZE + x) * 4 + 3] < 128) continue;
      first = Math.min(first, x); last = x;
    }
    if (last < first) continue;
    const offset = jawOffset(face, masterY);
    // Hair stays fixed. Fade the whole side of a row at the hair contact,
    // avoiding the local pinches caused by changing displacement pixel by pixel.
    const rightShift = offset * smooth(distance[y * SIZE + last] / 32);
    const leftShift = -offset * smooth((masterY - 855) / 65) * smooth(distance[y * SIZE + first] / 32);
    const rightEdge = last / SCALE + rightShift;
    const leftEdge = first / SCALE + leftShift;
    const rightInk = rightEdge - 22, leftInk = leftEdge + 22;
    const rightAnchor = Math.min(860 - 185 * smooth((masterY - 835) / 85), rightInk - Math.max(42, Math.abs(rightShift) * 2));
    const leftAnchor = Math.max(650, leftInk + Math.max(42, Math.abs(leftShift) * 2));
    for (let x = Math.floor(440 * SCALE); x < Math.ceil(1020 * SCALE); x++) {
      const pixel = y * SIZE + x;
      if (protectedHair[pixel]) continue;
      const masterX = x / SCALE;
      // Keep the facial-feature area untouched, then translate the outer ink
      // at constant scale. No vertical stretch: beard and jaw share the chin.
      const sourceMasterX = masterX >= rightAnchor ? masterX - rightShift * smooth((masterX - rightAnchor) / (rightInk - rightAnchor))
        : masterX < leftAnchor ? masterX - leftShift * smooth((leftAnchor - masterX) / (leftAnchor - leftInk)) : masterX;
      const shiftX = (sourceMasterX - masterX) * SCALE;
      const safeWeight = Math.min(1, distance[pixel] * .65 / (Math.abs(shiftX) || 1));
      const sourceX = x + shiftX * safeWeight;
      if (protectedHair[y * SIZE + Math.round(sourceX)]) continue;
      sample(source, image.data, pixel * 4, sourceX, y);
    }
  }
}

function recolor(image: ImageData, skinHex: string, hairHex: string, eyesHex: string, hairRegion?: Uint8Array) {
  const skin = rgb(skinHex), hair = rgb(hairHex), eyes = rgb(eyesHex);
  const source = new Uint8ClampedArray(image.data);
  const cream = creamMask(source);
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] < 8) continue;
    const r = source[i], g = source[i + 1], b = source[i + 2], light = lightness(r, g, b);
    const pixel = i / 4;
    const x = pixel % SIZE, y = Math.floor(pixel / SIZE);
    const eye = inEyes(x, y), neutral = isNeutral(r, g, b);
    const iris = eye && r > 35 && r < 200 && light > 25 && r > g * 1.35 && r < g * 3.2 && g > b * 1.1;
    // The whites, teeth and reflected pinpoints stay cream. Real black pupils
    // also retain their ink; only the warm painted iris receives the eye colour.
    if (light < 12 || (eye && light < 60 && !iris) || cream[pixel] || isTongue(r, g, b, x, y)) continue;
    if (iris) {
      const shade = clamp(light / 53, .2, 1.45);
      for (let channel = 0; channel < 3; channel++) image.data[i + channel] = Math.min(255, eyes[channel] * shade);
    } else if (!eye && hairRegion?.[pixel] && (isHair(r, g, b) || neutral)) {
      if (neutral) continue;
      const chestnut = [105, 68, 50] as const;
      const warmPalette = hair[0] > hair[2] * 1.4 && hair[0] > hair[1] * 1.15;
      for (let channel = 0; channel < 3; channel++) {
        // Preserve each painted channel's shadows and warm highlights. The
        // chestnut choice is the original artwork, with no grey/white wash.
        const value = source[i + channel], base = chestnut[channel];
        image.data[i + channel] = value <= base
          ? hair[channel] * value / base
          : hair[channel] + (255 - hair[channel]) * (value - base) / (255 - base);
        // Neutral/cool choices need neutral highlights, rather than inheriting
        // copper strands that would make the black or silver choice look brown.
        if (!warmPalette) {
          const shade = light / 84;
          image.data[i + channel] = shade <= 1 ? hair[channel] * shade
            : hair[channel] + (255 - hair[channel]) * clamp((shade - 1) * .35, 0, .45);
        }
      }
    } else if (neutral || (r >= g * .985 && r < g * 1.9 && g >= b * .98 && b > 10)) {
      // Per-channel ratios retain the warm cheek wash, lower-jaw shadow and
      // paper grain for every skin tone, including the darkest palettes.
      const paperSkin = [252, 227, 192] as const;
      for (let channel = 0; channel < 3; channel++) image.data[i + channel] = Math.min(255, skin[channel] * source[i + channel] / paperSkin[channel]);
    }
  }
}

async function render(profile: Profile): Promise<HTMLCanvasElement> {
  const appearance = getChanvrierAppearance(profile);
  const glasses = appearance.accessory === "glasses" || appearance.accessory === "round-glasses";
  const names = [`head-${appearance.hair}`, "head-bald"];
  if (appearance.nose !== "round") names.push(`patch-nose-${appearance.nose}`);
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
    const drawing = parts.get(`patch-facialHair-${facialHair}`)!;
    // Only add the hair and its ink. The complete source head has a slightly
    // different cheek outline; copying its skin would cut a notch under the eye.
    patch(result, drawing, facialHair === "moustache" ? [625, 707, 900, 820] : [300, 635, 980, 1050], protectedHair, 8, true, hairMask(drawing.data));
  }
  if (appearance.eyebrows !== "natural") patch(result, parts.get(`patch-eyebrows-${appearance.eyebrows}`)!, REGISTRATION.browPatch, protectedHair);
  if (appearance.mouth !== "grin" || facialHair !== "none") {
    const mouth = parts.get(appearance.mouth === "grin" ? "head-bald" : `patch-mouth-${appearance.mouth}`)!;
    // The new facial hair and its ink stay above every expression. Replace the
    // entire old mouth, including its upper lip, without painting over the beard.
    const protectedFacialHair = facialHair === "none" ? protectedHair : hairMask(result.data);
    patch(result, mouth, REGISTRATION.mouthPatch, protectedFacialHair);
  }
  const paintedHair = hairMask(result.data);
  const protectedFacialHair = facialHair === "none" ? protectedHair : paintedHair;
  const protectedBrows = appearance.eyes === "almond" ? protectedHair : protectBrows(result, protectedHair);
  const palette = [CHANVRIER_SKINS.find(option => option.code === profile.skin)!.color, OPTIONS.hairColor.find(option => option.code === appearance.hairColor)!.color, OPTIONS.eyeColor.find(option => option.code === appearance.eyeColor)!.color] as const;
  // Tint the registered eyes before reshaping them, preserving their ink and glints.
  recolor(result, ...palette, paintedHair);
  if (appearance.eyes !== "almond") {
    const scale: readonly [number, number] = appearance.eyes === "round" ? [1.2, .94] : appearance.eyes === "relaxed" ? [1.06, .65] : [1.2, 1.1];
    // Anchor the lower eyelid. The v6 sclera extends further down than the old
    // pill eyes: a centre-anchored squeeze would strand a white strip beneath it.
    eyeWarp(result, [625, 575, 744, 716], [682, 709], scale, protectedBrows);
    eyeWarp(result, [753, 540, 864, 676], [809, 671], scale, protectedBrows);
  }
  // The master supplies the round nose. Separate nose drawings are applied after
  // the eyes and expressions. The lower nose tile stops before the old smile's
  // right corner: a full rectangle would reintroduce it into the calm expression.
  if (appearance.nose !== "round") {
    const nose = parts.get(`patch-nose-${appearance.nose}`)!;
    recolor(nose, ...palette);
    patch(result, nose, [745, 657, 875, 740], protectedFacialHair, 3);
    patch(result, nose, [745, 734, 830, 758], protectedFacialHair, 3);
    if (appearance.nose === "wide") {
      patch(result, nose, [714, 696, 756, 758], protectedFacialHair, 3);
      patch(result, nose, [729, 680, 756, 714], protectedFacialHair, 3);
    }
  }
  faceWarp(result, parts.get("head-bald")!, appearance.face, protectedHair);
  if (glasses) glassesPatch(result, parts.get(`patch-accessory-${appearance.accessory}`)!, parts.get("head-bald")!, protectedHair);
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
