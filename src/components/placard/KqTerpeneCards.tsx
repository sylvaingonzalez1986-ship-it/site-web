"use client";

import Image from 'next/image';
import { useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Atom, BookOpen, Search, Wind, X, ZoomIn } from 'lucide-react';
import { navigateAfterOverlays } from '@/lib/overlay-history';
import { TERPENE_COMPOUND_SOURCES } from '@/lib/kanab-quest-school-terpenes-compounds';
import { cannabisArticleRevision, CANNABIS_REVIEWED_SOURCES } from '@/lib/kanab-quest-cannabis-revision';
import type { TerpeneAromaFamily, TerpeneCompound } from '@/lib/kanab-quest-school-terpenes-types';
import { TERPENE_FAMILY_LABELS } from '@/lib/kanab-quest-school-terpenes-visuals';
import { TERPENE_MOLECULAR_STRUCTURES } from '@/lib/kanab-quest-school-terpene-structures';
import { filterTerpeneCards, getTerpeneAromaVisuals, hasDescribedTerpeneAroma, TERPENE_CARDS, TERPENE_CARD_FILTERS, terpeneCardNumber } from '@/lib/kanab-quest-terpene-cards';
import { clickedCollectionBackdrop, useKqCollectionDialog } from './KqCollectionDialog';
import styles from './KqTerpeneCards.module.css';

type OpenCard = (id: string, ids: readonly string[]) => void;
const shortFamily = (item: TerpeneCompound) => TERPENE_FAMILY_LABELS[item.family].split(' · ')[0];
const formulaText = (value: string) => value.replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);

function AromaArt({ compound }: { compound: TerpeneCompound }) {
  const notes = getTerpeneAromaVisuals(compound);
  return <span className={styles.aromaArt} data-terpene-aroma-art>
    {notes.map(note => <span className={styles.aromaNote} key={note.label}>
      <Image src={note.image} alt="" width={512} height={512} unoptimized/>
      <span>{note.label}</span>
    </span>)}
  </span>;
}

function CardFace({ compound, molecule = false, enlarged = false }: { compound: TerpeneCompound; molecule?: boolean; enlarged?: boolean }) {
  const structure = TERPENE_MOLECULAR_STRUCTURES[compound.id];
  const scientificImage = cannabisArticleRevision(`record-terpene-${compound.id}`)?.image;
  return <span className={styles.face} data-family={compound.family} data-enlarged={enlarged || undefined}>
    <span className={styles.cardTop}><span>{shortFamily(compound)}</span><span>N° {terpeneCardNumber(compound.id)}</span></span>
    <strong className={styles.cardName}>{compound.name}</strong>
    <span className={styles.artWindow}>
      {molecule && structure ? <span className={styles.moleculeArt}><Image src={structure.structureImage} alt={scientificImage?.alt || `Structure chimique de ${compound.name}. ${structure.isomerNote}`} width={600} height={450} unoptimized/><span>Structure 2D · PubChem</span></span> : <AromaArt compound={compound}/>}
    </span>
    <span className={styles.odor}>{hasDescribedTerpeneAroma(compound) ? compound.aroma.description : 'Description olfactive non documentée dans ce corpus.'}</span>
    <span className={styles.cardFoot}><span>{structure ? <><Atom size={16} aria-hidden/>{formulaText(structure.formula)}</> : shortFamily(compound)}</span>{!enlarged ? <span><ZoomIn size={16} aria-hidden/>Voir la fiche</span> : <span>Terpènes du chanvre</span>}</span>
  </span>;
}

/** Manually controlled cards from the curated cannabis selection. */
export function KqTerpeneCardDeck({ onOpen }: { onOpen: OpenCard }) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<TerpeneAromaFamily | 'all'>('all');
  const [position, setPosition] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const track = useRef<HTMLUListElement>(null);
  const searchId = useId(), headingId = useId();
  const cards = filterTerpeneCards(query, family);
  const resetPosition = () => { setPosition(0); setAtEnd(false); track.current?.scrollTo({ left: 0, behavior: 'instant' }); };
  function move(next: number) {
    const target = track.current?.children[Math.min(Math.max(0, next), cards.length - 1)] as HTMLElement | undefined;
    if (target && track.current) track.current.scrollTo({ left: target.offsetLeft - (track.current.firstElementChild as HTMLElement).offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function onTrackKeys(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = [...(track.current?.querySelectorAll('button') || [])].indexOf(document.activeElement as HTMLButtonElement);
    const next = Math.min(cards.length - 1, Math.max(0, (current < 0 ? position : current) + (event.key === 'ArrowRight' ? 1 : -1)));
    track.current?.querySelectorAll('button')[next]?.focus({ preventScroll: true }); move(next);
  }
  return <section className={styles.deck} aria-labelledby={headingId} data-terpene-deck>
    <div className={styles.deckHeading}><div><h3 id={headingId}>Les terpènes du cannabis</h3><p>Une sélection de {TERPENE_CARDS.length} terpènes et terpénoïdes documentés dans le cannabis.</p></div><span className={styles.total}>{TERPENE_CARDS.length}<small>cartes</small></span></div>
    <div className={styles.filters} role="group" aria-label="Filtrer par famille olfactive">
      <button type="button" aria-pressed={family === 'all'} onClick={() => { setFamily('all'); resetPosition(); }}>Tous</button>
      {TERPENE_CARD_FILTERS.map(filter => <button type="button" key={filter.id} data-aroma-filter={filter.id} aria-pressed={family === filter.id} onClick={() => { setFamily(filter.id); resetPosition(); }}><Image src={filter.image} alt="" width={38} height={38} unoptimized/><span>{filter.label}</span></button>)}
    </div>
    <div className={styles.tools}><label htmlFor={searchId}><Search size={18} aria-hidden/><span className={styles.srOnly}>Rechercher un terpène, un synonyme ou une odeur</span><input id={searchId} data-terpene-search type="search" value={query} maxLength={100} placeholder="Nom, synonyme ou odeur…" onChange={event => { setQuery(event.target.value); resetPosition(); }}/></label><span role="status">{cards.length} carte{cards.length > 1 ? 's' : ''}</span></div>
    {cards.length ? <>
      <ul ref={track} className={styles.track} aria-label="Cartes des terpènes" aria-roledescription="carrousel" onKeyDown={onTrackKeys} onScroll={() => {
        const list = track.current;
        if (!list?.firstElementChild) return;
        const step = (list.children[1] as HTMLElement | undefined)?.offsetLeft ?? 0;
        const firstOffset = (list.firstElementChild as HTMLElement).offsetLeft;
        setAtEnd(list.scrollLeft + list.clientWidth >= list.scrollWidth - 2);
        setPosition(step > firstOffset ? Math.min(cards.length - 1, Math.round(list.scrollLeft / (step - firstOffset))) : 0);
      }}>
        {cards.map(compound => <li key={compound.id}><button type="button" className={styles.card} data-terpene-card={compound.id} data-reference-entry={`record-terpene-${compound.id}`} aria-haspopup="dialog" aria-label={`Ouvrir la carte ${compound.name}`} onClick={() => onOpen(compound.id, cards.map(item => item.id))}><CardFace compound={compound}/></button></li>)}
      </ul>
      <nav className={styles.carouselNav} aria-label="Faire défiler les cartes"><button type="button" aria-label="Cartes précédentes" disabled={position === 0} onClick={() => move(position - 1)}><ArrowLeft size={20} aria-hidden/></button><span>Fais défiler puis ouvre une carte</span><button type="button" aria-label="Cartes suivantes" disabled={atEnd || cards.length < 2} onClick={() => move(position + 1)}><ArrowRight size={20} aria-hidden/></button></nav>
    </> : <div className={styles.empty}><p>Aucun terpène pour cette recherche.</p><button type="button" onClick={() => { setQuery(''); setFamily('all'); resetPosition(); }}>Afficher toutes les cartes</button></div>}
  </section>;
}

export function KqTerpeneCardDialog({ initialId, ids, onClose, onRead }: { initialId: string; ids: readonly string[]; onClose: () => void; onRead: (id: string) => void }) {
  const sequence = ids.filter(id => TERPENE_CARDS.some(item => item.id === id));
  const [id, setId] = useState(initialId);
  const [molecule, setMolecule] = useState(false);
  const dialog = useKqCollectionDialog(onClose);
  const titleId = useId();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const compound = TERPENE_CARDS.find(item => item.id === id);
  if (!compound) return null;
  const position = sequence.indexOf(id), structure = TERPENE_MOLECULAR_STRUCTURES[id];
  const revision = cannabisArticleRevision(`record-terpene-${id}`);
  const section = (name: string) => revision?.sections?.find(item => item.id === name);
  const sourceIds = revision?.sourceIds || compound.sourceIds;
  const sources = [...new Map([...TERPENE_COMPOUND_SOURCES, ...CANNABIS_REVIEWED_SOURCES].map(source => [source.id, source])).values()].filter(source => sourceIds.includes(source.id));
  function move(delta: number) {
    const next = sequence[(position + delta + sequence.length) % sequence.length];
    if (next) { setId(next); setMolecule(false); dialog.current?.querySelector('[data-terpene-detail-body]')?.scrollTo({ top: 0, behavior: 'instant' }); }
  }
  function swipeEnd(event: TouchEvent) {
    if (!touch.current) return;
    const point = event.changedTouches[0], dx = point.clientX - touch.current.x, dy = point.clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    touch.current = null;
  }
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} data-terpene-dialog={id}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => { if (clickedCollectionBackdrop(event)) onClose(); }}
    onKeyDown={event => {
      if (event.key === 'Escape') event.stopPropagation();
      if (event.key === 'Tab') {
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary')].filter(item => item.checkVisibility());
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowRight' ? 1 : -1); }
    }}>
    <header className={styles.dialogHeader}><span id={titleId}>Fiche · {compound.name}</span><button type="button" aria-label="Fermer la fiche du terpène" onClick={onClose}><X size={22} aria-hidden/></button></header>
    <div className={styles.detailBody} data-terpene-detail-body>
      <div className={styles.detailLayout}>
        <div className={styles.detailCardArea}>
          <div className={styles.enlargedCard} onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={swipeEnd}><CardFace compound={compound} molecule={molecule} enlarged/></div>
          {structure ? <div className={styles.viewSwitch} role="group" aria-label="Illustration de la carte"><button type="button" aria-pressed={!molecule} onClick={() => setMolecule(false)}><Wind size={16} aria-hidden/>Arômes</button><button type="button" aria-pressed={molecule} data-terpene-molecule onClick={() => setMolecule(true)}><Atom size={16} aria-hidden/>Molécule</button></div> : null}
          {molecule && structure ? <p className={styles.structureNote}>{revision?.image?.caption || structure.isomerNote} <a href={structure.sourceUrl} target="_blank" rel="noreferrer">PubChem</a>{revision?.image?.licenseUrl ? <> · {revision.image.author} · <a href={revision.image.licenseUrl} target="_blank" rel="noreferrer">Droits du dessin</a></> : null}</p> : null}
        </div>
        <div className={styles.characteristics} key={id}>
          <h3>Ses caractéristiques</h3>
          <dl className={styles.facts}>
            <div><dt>Famille chimique</dt><dd>{TERPENE_FAMILY_LABELS[compound.family]}</dd></div>
            {structure ? <div><dt>Formule</dt><dd className={styles.formula}>{formulaText(structure.formula)}</dd></div> : null}
            {compound.synonyms.length ? <div><dt>Autres noms</dt><dd>{compound.synonyms.join(' · ')}</dd></div> : null}
            {section('plants') || compound.otherPlants.length ? <div><dt>Autres plantes documentées</dt><dd><ul className={styles.plants}>{section('plants') ? section('plants')!.paragraphs.map((paragraph, index) => <li key={index}>{paragraph}</li>) : compound.otherPlants.map(plant => <li key={plant.name}>{plant.name}</li>)}</ul></dd></div> : null}
          </dl>
          <p className={styles.sensoryNote}>Les images évoquent des odeurs. Leur perception varie selon l’isomère, la concentration et le mélange.</p>
          <details><summary>Présence dans le cannabis</summary>{section('cannabis') ? section('cannabis')!.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <>{compound.cannabisEvidence.map((evidence, index) => <p key={index}>{evidence.statement}</p>)}<p>{compound.identification.statement}</p></>}</details>
          <details><summary>Isomères et structure</summary>{section('identity') ? section('identity')!.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>{compound.isomerNotes}</p>}{structure ? <a href={structure.sourceUrl} target="_blank" rel="noreferrer">Structure PubChem · CID {structure.pubchemCid}</a> : <p>Comparaison chimique illustrée dans la fiche complète.</p>}</details>
          <details><summary>Sources ({sources.length})</summary><ul className={styles.sources}>{sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.organization} · {source.published}</span></li>)}</ul></details>
          <button type="button" className={styles.readArticle} onClick={() => navigateAfterOverlays(() => onRead(`record-terpene-${id}`))}><BookOpen size={18} aria-hidden/>Lire la fiche complète</button>
        </div>
      </div>
    </div>
    <nav className={styles.dialogNav} aria-label="Parcourir les fiches de terpènes"><button type="button" aria-label="Terpène précédent" disabled={sequence.length < 2} onClick={() => move(-1)}><ArrowLeft size={20} aria-hidden/></button><span aria-live="polite" aria-atomic="true"><strong>{compound.name}</strong><small>{position + 1} / {sequence.length}</small></span><button type="button" aria-label="Terpène suivant" disabled={sequence.length < 2} onClick={() => move(1)}><ArrowRight size={20} aria-hidden/></button></nav>
  </dialog>, document.body);
}

/** The same card is available when arriving through an article or a Buddy link. */
export function KqTerpeneArticleCard({ id, onRead }: { id: string; onRead: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const compound = TERPENE_CARDS.find(item => item.id === id);
  if (!compound) return null;
  return <div className={styles.articleCard}>
    <button type="button" className={styles.card} aria-label={`Ouvrir la carte ${compound.name}`} aria-haspopup="dialog" onClick={() => setOpen(true)}><CardFace compound={compound}/></button>
    {open ? <KqTerpeneCardDialog initialId={id} ids={TERPENE_CARDS.map(item => item.id)} onClose={() => setOpen(false)} onRead={onRead}/> : null}
  </div>;
}
