import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterTerpeneCards, getTerpeneAromaVisuals, TERPENE_CARDS, TERPENE_CARD_AROMAS, terpeneCardNumber } from './kanab-quest-terpene-cards';
import { CANNABIS_TERPENE_CARD_IDS } from './kanab-quest-cannabis-terpene-selection';
import { TERPENE_COMPOUNDS, TERPENE_COMPOUND_SOURCES } from './kanab-quest-school-terpenes-compounds';

describe('Illustrated terpene cards', () => {
  it('selects documented cannabis compounds with actual illustrations and keeps the original corpus', () => {
    expect(TERPENE_COMPOUNDS).toHaveLength(86);
    expect(TERPENE_CARDS).toHaveLength(28);
    expect(new Set(TERPENE_CARDS.map(item => item.id))).toEqual(new Set(CANNABIS_TERPENE_CARD_IDS));
    expect(new Set(Object.keys(TERPENE_CARD_AROMAS))).toEqual(new Set(CANNABIS_TERPENE_CARD_IDS));
    expect(new Set(TERPENE_CARDS.map(item => terpeneCardNumber(item.id))).size).toBe(28);
    for (const compound of TERPENE_CARDS) {
      expect(['reference-standard', 'ri-ms-supported']).toContain(compound.identification.level);
      expect(compound.cannabisEvidence.length, compound.id).toBeGreaterThan(0);
      expect(compound.aroma.sourceIds.length, compound.id).toBeGreaterThan(0);
      for (const source of compound.aroma.sourceIds) expect(TERPENE_COMPOUND_SOURCES.some(item => item.id === source)).toBe(true);
      expect(getTerpeneAromaVisuals(compound).length, compound.id).toBeGreaterThan(0);
      for (const visual of getTerpeneAromaVisuals(compound)) {
        expect(existsSync(`public${visual.image}`), visual.image).toBe(true);
        expect(visual.image).not.toContain('course-molecules');
      }
    }
    const audit = JSON.parse(readFileSync('docs/bete-de-concours/cannabis-terpene-selection-provenance.json', 'utf8'));
    expect(audit.counts).toMatchObject({ selectedCards: 28, excludedFromCards: 58 });
  });
  it('supports synonyms, accents, Greek letters and combined words with aroma filters', () => {
    expect(filterTerpeneCards('LINALOOL').map(item => item.id)).toEqual(['linalool']);
    expect(filterTerpeneCards('fenchylique alcool').map(item => item.id)).toEqual(['fenchol']);
    expect(filterTerpeneCards('α pinene').map(item => item.id)).toEqual(['alphapinene']);
    expect(filterTerpeneCards('citron', 'citrus').some(item => item.id === 'limonene')).toBe(true);
    expect(filterTerpeneCards('linalool', 'citrus')).toEqual([]);
    expect(filterTerpeneCards('xxxxxxxx')).toEqual([]);
    expect(filterTerpeneCards('gamma eudesmol')).toEqual([]);
    expect(filterTerpeneCards('alpha bergamotene')).toEqual([]);
  });
  it('does not invent scents for unknown compounds or turn herbal/sweet into pine/honey', () => {
    const notes = (id: string) => getTerpeneAromaVisuals(TERPENE_CARDS.find(item => item.id === id)!);
    expect(notes('myrcene').map(item => item.label)).toEqual(['Épicé', 'Résine', 'Herbacé']);
    expect(notes('limonene').map(item => item.label)).toEqual(['Citron', 'Agrumes']);
    expect(notes('alphapinene').map(item => item.label)).toEqual(['Pin', 'Térébenthine']);
    expect(notes('linalool')[0].label).toBe('Lavande');
    expect(notes('terpinen4-ol').map(item => item.label)).toEqual(['Muscade', 'Térébenthine']);
    expect(notes('geranyl-acetate')[0].label).toBe('Rose');
    expect(notes('e-beta-ocimene').map(item => item.label)).toEqual(['Herbacé']);
    for (const item of TERPENE_COMPOUNDS.filter(item => item.aroma.families.every(family => family === 'other'))) expect(getTerpeneAromaVisuals(item)).toEqual([]);
  });
});
