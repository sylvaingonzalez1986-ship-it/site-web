"use client";

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BrushCleaning, Check, Coins, KeyRound, Mail, PaintRoller, Ruler } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { ARENA_RELEVE_LETTER, ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
import type { ReleveRenovation } from '@/lib/arena-releve-session';
import { formatKqCash } from '@/lib/kanab-quest-equipment';
import styles from './ArenaReleveArrival.module.css';

const SCENES = {
  locked: { src: ARENA_RELEVE_SCENES.arrival, alt: 'Sylvain tend les clés devant les portes turquoise de la ferme.', title: 'La ferme de Grand-père', action: 'Les clés', label: 'Prendre les clés et ouvrir la grange', Icon: KeyRound, anchor: [39, 43], camera: 40 },
  opened: { src: '/contest/releve/clearing-sylvain-v1.webp', alt: 'Dans la grange vide de tout animal, Sylvain attend avec son balai. Les anciennes installations sont à retirer.', title: 'On fait place nette', action: 'Tout vider', label: 'Vider la grange', Icon: BrushCleaning, anchor: [73, 76], camera: 70 },
  emptied: { src: '/contest/releve/worksite-sylvain-v1.webp', alt: 'Le chantier : un sol neuf, des panneaux techniques et la ventilation en cours de pose. Aucune plante.', title: 'La transformation', action: 'Rénover', label: 'Rénover tout l’intérieur', Icon: PaintRoller, anchor: [85, 79], camera: 76 },
  renovated: { src: ARENA_RELEVE_SCENES.renovation, alt: 'La chambre de culture professionnelle terminée : sol en résine, parois techniques et ventilation. Les 100 m² sont prêts à aménager.', title: 'À toi les 100 m²', action: 'Aménager', label: 'Continuer : aménager mon entrepôt', Icon: Ruler, anchor: [63, 65], camera: 56 },
} as const;
const ACTION_RESULTS = {
  locked: 'Clés récupérées',
  opened: 'Place nette !',
  emptied: 'Chambre prête !',
} as const;
const STAGES = ['locked', 'opened', 'emptied', 'renovated'] as const;
const PORTRAITS = {
  locked: { src: '/contest/releve/arrival-sylvain-portrait-v1.webp', anchor: [53, 46], camera: 38 },
  opened: { src: '/contest/releve/clearing-sylvain-portrait-v1.webp', anchor: [65, 61], camera: 38 },
  emptied: { src: '/contest/releve/worksite-sylvain-portrait-v1.webp', anchor: [72, 66], camera: 42 },
  renovated: { src: '/contest/releve/renovation-sylvain-portrait-v1.webp', anchor: [55, 51], camera: 42 },
} as const;

export function ArenaReleveArrival({ renovation, onRenovate, onContinue, toolbar, cashCents }: {
  renovation: ReleveRenovation; onRenovate: () => void; onContinue: () => void; toolbar: ReactNode; cashCents: number;
}) {
  const [letterOpen, setLetterOpen] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [firstStage] = useState(renovation);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set());
  const [actionFeedback, setActionFeedback] = useState<{ stage: keyof typeof ACTION_RESULTS; left: number | string; top: number | string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const scene = SCENES[renovation];
  const index = STAGES.indexOf(renovation);
  useLayoutEffect(() => {
    const element = sceneRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);
  // Portrait compositions keep Sylvain and the object together on tall screens.
  const portrait = size.width > 0 && size.width <= 700 && size.height > size.width;
  const artwork = portrait ? PORTRAITS[renovation] : scene;
  const imageWidth = portrait ? 1024 : 1536, imageHeight = portrait ? 1536 : 1024;
  const scale = Math.max(size.width / imageWidth, size.height / imageHeight);
  const x = (size.width - imageWidth * scale) * artwork.camera / 100 + imageWidth * scale * artwork.anchor[0] / 100;
  const y = (size.height - imageHeight * scale) / 2 + imageHeight * scale * artwork.anchor[1] / 100;
  const position = size.width ? { left: Math.max(78, Math.min(size.width - 78, x)), top: Math.max(portrait ? 195 : 155, Math.min(size.height - (portrait ? 185 : 145), y)) } : { left: `${scene.anchor[0]}%`, top: `${scene.anchor[1]}%` };
  const act = () => {
    if (renovation === 'renovated') {
      onContinue();
      return;
    }
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setActionFeedback({ stage: renovation, ...position });
    feedbackTimer.current = setTimeout(() => setActionFeedback(null), 1400);
    onRenovate();
  };
  return <section className={styles.arrival} data-releve-renovation={renovation} aria-label="La ferme de Grand-père">
    <div className={styles.scene} ref={sceneRef} data-releve-game-view>
      {size.width > 0 && size.height > 0 && STAGES.map((stage, stageIndex) => {
        const layer = portrait ? PORTRAITS[stage] : SCENES[stage];
        const current = stage === renovation;
        // Completed scenes stay underneath: the next one fades in only once its
        // image has loaded, including when a player clicks before preloading ends.
        const visible = stageIndex >= STAGES.indexOf(firstStage) && stageIndex <= index && loadedImages.has(layer.src);
        return <Image key={stage} className={styles.artwork} src={layer.src} alt={current ? scene.alt : ''} aria-hidden={!current} fill sizes="100vw" loading="eager" fetchPriority={current ? 'high' : 'low'} data-releve-scene-current={current} data-visible={visible} style={{ objectPosition: `${layer.camera}% 50%`, zIndex: stageIndex }} onLoad={() => setLoadedImages(currentImages => currentImages.has(layer.src) ? currentImages : new Set([...currentImages, layer.src]))} />;
      })}
      <div className={styles.shade} aria-hidden="true" />
      <header className={styles.hud}>
        <div className={styles.location}><span>La relève · 1/9</span><h2>{scene.title}</h2></div>
        <div className={styles.budget}><Coins size={20} aria-hidden="true" /><strong>{formatKqCash(cashCents)}<small>Équipement · essai</small></strong></div>
      </header>
      <button type="button" className={styles.hotspot} style={position} data-releve-action={renovation !== 'renovated' ? 'renovate' : undefined} data-releve-next={renovation === 'renovated' ? true : undefined} aria-label={scene.label} onClick={act}>
        <span className={styles.target}><scene.Icon size={29} strokeWidth={2.3} aria-hidden="true" /></span>
        <span className={styles.actionLabel}>{scene.action}</span>
      </button>
      {actionFeedback ? <span key={actionFeedback.stage} className={styles.actionFeedback} style={{ left: actionFeedback.left, top: actionFeedback.top }} role="status"><Check size={18} aria-hidden="true" />{ACTION_RESULTS[actionFeedback.stage]}</span> : null}
      <div className={styles.bottom}>
        <ol className={styles.steps} aria-label="Transformation de la ferme">
          {STAGES.map((stage, step) => {
            const Icon = SCENES[stage].Icon;
            return <li key={stage} aria-label={SCENES[stage].title} aria-current={step === index ? 'step' : undefined} data-done={step < index}><span>{step < index ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}</span></li>;
          })}
        </ol>
        <div className={styles.inventory}>
          <button type="button" className={styles.letterButton} data-releve-letter aria-label="Ouvrir la lettre de Grand-père" aria-haspopup="dialog" title="La lettre de Grand-père" onClick={() => setLetterOpen(true)}><Mail size={22} aria-hidden="true" /><span>La lettre</span></button>
          {toolbar}
        </div>
      </div>
    </div>
    {letterOpen ? createPortal(<AppDialog open onClose={() => setLetterOpen(false)} title="La lettre de Grand-père" closeLabel="Ranger la lettre" className={styles.letterDialog} bodyClassName={styles.letterBody} dialogProps={{ 'data-releve-letter-dialog': true }}>
      <div className={styles.envelope}><Mail size={36} aria-hidden="true" /></div>
      <article className={styles.letter}>{ARENA_RELEVE_LETTER.map(line => <p key={line}>{line}</p>)}</article>
    </AppDialog>, document.body) : null}
  </section>;
}
