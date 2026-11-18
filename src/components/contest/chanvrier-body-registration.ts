type Point = readonly [number, number];
type Region = { seed: Point; bounds: readonly [number, number, number, number] };
type SkinRegistration = {
  /** The painted mid-light skin, measured in the untrimmed exported layer. */
  source: readonly [number, number, number];
  regions: readonly Region[];
};

/** Skin alone is recolored inside these inked boundaries. Cream sleeves,
 * work gloves and skirt stockings are part of the original clothing artwork. */
export const CHANVRIER_BODY_SKIN: Readonly<Record<string, SkinRegistration>> = {
  "top-tee": {
    source: [247, 177, 143],
    regions: [
      { seed: [195, 675], bounds: [139, 588, 260, 730] },
      { seed: [590, 675], bounds: [530, 590, 635, 735] },
    ],
  },
  "top-shirt": {
    source: [249, 173, 137],
    regions: [
      { seed: [195, 675], bounds: [139, 612, 260, 730] },
      { seed: [590, 675], bounds: [530, 624, 635, 735] },
    ],
  },
  "top-apron": {
    source: [247, 179, 145],
    regions: [
      { seed: [195, 675], bounds: [124, 588, 260, 730] },
      { seed: [590, 675], bounds: [545, 594, 652, 735] },
    ],
  },
  "legs-shorts": {
    source: [251, 198, 166],
    regions: [
      { seed: [318, 1060], bounds: [270, 975, 359, 1145] },
      { seed: [458, 1060], bounds: [415, 975, 500, 1145] },
    ],
  },
  "legs-skirt": {
    source: [244, 183, 153],
    regions: [
      { seed: [326, 1130], bounds: [295, 1110, 360, 1147] },
      { seed: [454, 1130], bounds: [420, 1110, 489, 1147] },
    ],
  },
};

/** Follow the source's inked sleeve/cuff boundary, instead of cutting skin with
 * a rectangle or treating the similarly warm cream sleeves as bare arms. */
export function createChanvrierBodySkinMask(name: string, data: Uint8ClampedArray, width: number, height: number): Uint8Array | undefined {
  const registration = CHANVRIER_BODY_SKIN[name];
  if (!registration) return;
  const mask = new Uint8Array(width * height);
  for (const { seed, bounds: [left, top, right, bottom] } of registration.regions) {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const pixel = y * width + x, i = pixel * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] >= 8 && r > 75 && r > g + 4 && g > b + 3 && r - g > (g - b) * .75) mask[pixel] = 1;
    }
    const start = seed[1] * width + seed[0];
    if (mask[start] !== 1) continue;
    const connected = [start];
    mask[start] = 2;
    for (let cursor = 0; cursor < connected.length; cursor++) {
      const pixel = connected[cursor];
      for (const next of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
        if (mask[next] !== 1) continue;
        mask[next] = 2;
        connected.push(next);
      }
    }
  }
  for (let pixel = 0; pixel < mask.length; pixel++) mask[pixel] = mask[pixel] === 2 ? 1 : 0;
  return mask;
}
