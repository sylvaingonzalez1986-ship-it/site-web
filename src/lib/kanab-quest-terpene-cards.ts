import { KQ_FLAVORS } from './kanab-quest-buddie-flavors';
import { normalizeCannabisSearch } from './kanab-quest-cannabis-reference';
import { CANNABIS_TERPENE_CARD_IDS } from './kanab-quest-cannabis-terpene-selection';
import { TERPENE_COMPOUNDS } from './kanab-quest-school-terpenes-compounds';
import { reviseTerpeneCard } from './kanab-quest-cannabis-revision';
import type { TerpeneAromaFamily, TerpeneCompound } from './kanab-quest-school-terpenes-types';

export type TerpeneAromaVisual = Readonly<{ label: string; image: string }>;
const newArt = (name: string) => `/placard/school/terpenes/aromas/${name}-v1.webp`;
export const TERPENE_AROMA_ART = {
  pin: { label: 'Pin', image: KQ_FLAVORS.pin.image },
  citron: { label: 'Citron', image: KQ_FLAVORS.citron.image },
  agrumes: { label: 'Agrumes', image: KQ_FLAVORS.agrumes.image },
  floral: { label: 'Floral', image: KQ_FLAVORS.floral.image },
  bois: { label: 'Boisé', image: KQ_FLAVORS.bois.image },
  epices: { label: 'Épicé', image: KQ_FLAVORS.epices.image },
  menthe: { label: 'Mentholé', image: KQ_FLAVORS.menthe.image },
  anis: { label: 'Anisé', image: KQ_FLAVORS.anis.image },
  herbace: { label: 'Herbacé', image: newArt('herbace') },
  camphre: { label: 'Camphré', image: newArt('camphre') },
  lavande: { label: 'Lavande', image: newArt('lavande') },
  resine: { label: 'Résine', image: newArt('resine') },
  muscade: { label: 'Muscade', image: newArt('muscade') },
  rose: { label: 'Rose', image: newArt('rose') },
  terebenthine: { label: 'Térébenthine', image: newArt('terebenthine') },
} as const satisfies Record<string, TerpeneAromaVisual>;
type AromaArtKey = keyof typeof TERPENE_AROMA_ART;
export const TERPENE_CARD_FILTERS: readonly { id: TerpeneAromaFamily; label: string; image: string }[] = [
  { id: 'citrus', label: 'Agrumes', image: TERPENE_AROMA_ART.agrumes.image },
  { id: 'woody', label: 'Boisé / résineux', image: TERPENE_AROMA_ART.resine.image },
  { id: 'floral', label: 'Floral', image: TERPENE_AROMA_ART.lavande.image },
  { id: 'spicy', label: 'Épicé', image: TERPENE_AROMA_ART.muscade.image },
  { id: 'herbal', label: 'Végétal / frais', image: TERPENE_AROMA_ART.herbace.image },
];
/** Explicit associations reviewed against each selected record's sensory text.
 * A drawing illustrates an odor word; it is not an occurrence or effects claim.
 * Descriptions stay complete below the pictures, including secondary unusual notes.
 */
export const TERPENE_CARD_AROMAS: Readonly<Record<typeof CANNABIS_TERPENE_CARD_IDS[number], readonly AromaArtKey[]>> = {
  alphapinene: ['pin', 'terebenthine'],
  betapinene: ['pin', 'resine'],
  myrcene: ['epices', 'resine', 'herbace'],
  limonene: ['citron', 'agrumes'],
  camphene: ['camphre'],
  'alpha-phellandrene': ['menthe', 'epices'],
  'delta3-carene': ['resine', 'citron'],
  'alpha-terpinene': ['citron'],
  'gamma-terpinene': ['terebenthine'],
  terpinolene: ['pin'],
  'e-beta-ocimene': ['herbace'],
  'z-beta-ocimene': ['floral', 'agrumes', 'herbace'],
  linalool: ['lavande'],
  fenchol: ['camphre'],
  borneol: ['camphre'],
  'alpha-terpineol': ['menthe', 'anis'],
  'terpinen4-ol': ['muscade', 'terebenthine'],
  eucalyptol: ['menthe'],
  'p-cymene': ['agrumes'],
  'beta-caryophyllene': ['bois', 'epices'],
  'alpha-humulene': ['bois'],
  'e-beta-farnesene': ['agrumes', 'herbace'],
  'alpha-selinene': ['herbace'],
  guaiol: ['bois'],
  'alpha-bisabolol': ['floral', 'epices'],
  nerolidol: ['floral', 'bois'],
  'caryophyllene-oxide': ['herbace', 'epices'],
  'geranyl-acetate': ['rose'],
};
const first = ['limonene', 'myrcene', 'linalool', 'alphapinene', 'beta-caryophyllene', 'alpha-humulene', 'betapinene', 'terpinolene'];
const selectedIds = new Set<string>(CANNABIS_TERPENE_CARD_IDS);
export const TERPENE_CARDS = TERPENE_COMPOUNDS.filter(item => selectedIds.has(item.id)).map(reviseTerpeneCard).sort((a, b) => {
  const rank = (id: string) => first.includes(id) ? first.indexOf(id) : first.length;
  return rank(a.id) - rank(b.id); // Preserve the corpus order after the familiar compounds.
});
export const terpeneCardNumber = (id: string) => String(TERPENE_CARDS.findIndex(item => item.id === id) + 1).padStart(2, '0');
export const hasDescribedTerpeneAroma = (item: TerpeneCompound) => item.aroma.families.some(family => family !== 'other');

export function getTerpeneAromaVisuals(item: TerpeneCompound): TerpeneAromaVisual[] {
  const keys: readonly AromaArtKey[] = Object.hasOwn(TERPENE_CARD_AROMAS, item.id) ? TERPENE_CARD_AROMAS[item.id as keyof typeof TERPENE_CARD_AROMAS] : [];
  return keys.map(key => TERPENE_AROMA_ART[key]);
}

export function filterTerpeneCards(query: string, family: TerpeneAromaFamily | 'all' = 'all') {
  const words = normalizeCannabisSearch(query).split(' ').filter(Boolean);
  return TERPENE_CARDS.filter(item => {
    if (family !== 'all' && !item.aroma.families.includes(family)) return false;
    const text = normalizeCannabisSearch([item.name, ...item.synonyms, item.aroma.description, ...item.otherPlants.map(plant => plant.name)].join(' '));
    const tokens = text.split(' ');
    return words.every(word => tokens.some(token => token.startsWith(word)));
  });
}
