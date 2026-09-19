import { CHANVRIER_CLOTHES, CHANVRIER_SKINS, getChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";

type Profile = Pick<ChanvrierProfile, "gender" | "clothing" | "skin" | "appearance">;
type Rgb = readonly [number, number, number];
type Layer = { name: string; color: string; source: Rgb; skinSource?: Rgb };

const WIDTH = 768;
const HEIGHT = 1280;
const ROOT = "/contest/avatars/sylvain-outfits-v5/";
const OCHRE: Rgb = [200, 149, 54];
const TEAL: Rgb = [8, 127, 124];
// The master uses a separate peach swatch for bare arms, legs and ankles.
const PEACH: Rgb = [232, 160, 141];
const images = new Map<string, Promise<HTMLImageElement>>();
const rendered = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<HTMLCanvasElement>>();

function load(name: string): Promise<HTMLImageElement> {
  const cached = images.get(name);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
        images.delete(name);
        reject(new Error(`Cadre d’illustration invalide : ${name}`));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      images.delete(name);
      reject(new Error(`Illustration indisponible : ${name}`));
    };
    image.src = `${ROOT}${name}.webp`;
  });
  images.set(name, promise);
  return promise;
}

function canvas(): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = WIDTH;
  result.height = HEIGHT;
  return result;
}

const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const luminance = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;

/** Tint the garment's saturated fill, retaining black ink and cream details. */
function tint(image: HTMLImageElement, layer: Layer, skin: Rgb, result: HTMLCanvasElement): HTMLCanvasElement {
  const context = result.getContext("2d", { willReadFrequently: true })!;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT);
  const data = pixels.data;
  const garmentColor = rgb(layer.color);
  const sourceLight = luminance(...layer.source);
  const skinLight = luminance(...(layer.skinSource ?? PEACH));
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const garment = layer.source === TEAL
      ? g > r * 1.6 && b > r * 1.4 && g > 25
      : layer.source === OCHRE && r > g * 1.14 && g > b * 1.35 && r > 45;
    const bareSkin = r > g * 1.25 && r < g * 1.9 && g > b * 1.035 && g < b * 1.34 && r > 65;
    if (!garment && !bareSkin) continue;
    const target = bareSkin ? skin : garmentColor;
    const shade = Math.min(1.4, luminance(r, g, b) / (bareSkin ? skinLight : sourceLight));
    for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.min(255, Math.round(target[channel] * shade));
  }
  context.putImageData(pixels, 0, 0);
  return result;
}

async function render(profile: Profile): Promise<HTMLCanvasElement> {
  const appearance = getChanvrierAppearance(profile);
  const color = (code: string) => CHANVRIER_CLOTHES.find(option => option.code === code)!.color;
  const skinColor = CHANVRIER_SKINS.find(option => option.code === profile.skin)!.color;
  const skirt = appearance.bottom === "skirt";
  const layers: Layer[] = [
    // These two edits have a lighter peach fill than the master's bare forearms.
    { name: `legs-${skirt ? "skirt" : "shorts"}`, color: skinColor, source: PEACH, skinSource: skirt ? [240, 168, 140] : [251, 184, 151] },
    { name: `shoes-${appearance.shoes}`, color: color(appearance.shoeColor), source: OCHRE },
    { name: `bottom-${appearance.bottom}`, color: color(appearance.bottomColor), source: TEAL },
    { name: `top-${appearance.top}`, color: color(profile.clothing), source: OCHRE },
  ];
  const skin = rgb(skinColor);
  const sources = await Promise.all(layers.map(layer => load(layer.name)));
  const result = canvas();
  const working = canvas();
  const context = result.getContext("2d")!;
  // Legs remain behind the footwear collars and trouser cuffs. All transparent
  // layers retain the master frame and exactly the same pose.
  layers.forEach((layer, index) => context.drawImage(tint(sources[index], layer, skin, working), 0, 0));
  return result;
}

/** Compose the interchangeable outfit layers in their shared full-body frame. */
export function renderChanvrierBody(profile: Profile): Promise<HTMLCanvasElement> {
  const appearance = getChanvrierAppearance(profile);
  const key = JSON.stringify([profile.skin, profile.clothing, appearance.top, appearance.bottom, appearance.bottomColor, appearance.shoes, appearance.shoeColor]);
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
