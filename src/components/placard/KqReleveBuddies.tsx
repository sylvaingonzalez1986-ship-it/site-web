"use client";

import { useState } from "react";
import { Check, PackageOpen, Save, Sprout } from "lucide-react";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KQ_BUDDIE_ROTATION_REQUIRED } from "@/lib/kanab-quest-buddie-rotation";
import { KQ_RELEVE_BUDDIES, type KqReleveProductionAction, type KqReleveProductionState } from "@/lib/kanab-quest-releve-production";
import { KqBuddieCarousel } from "./KqBuddieCarousel";
import { KqWarehousePlan } from "./KqWarehousePlan";
import styles from "./KqReleveBuddies.module.css";

/** The real collection cards and variety sheet, connected only to the practice farm. */
export function KqReleveBuddies({ state, onAction }: {
  state: KqReleveProductionState; onAction: (action: KqReleveProductionAction) => void;
}) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const activeZones = state.draftWarehouse.zones.filter(zone => zone.active);
  const zone = activeZones.find(item => item.id === zoneId) ?? activeZones[0];
  const revealed = state.ownedBuddies.length === KQ_RELEVE_BUDDIES.length;
  const dirty = JSON.stringify(state.warehouse) !== JSON.stringify(state.draftWarehouse);
  const cards = KQ_BUDDIES.filter(buddie => state.ownedBuddies.includes(buddie.code));

  return <div className={styles.buddies}>
    {!revealed ? <section className={styles.album} aria-label="L’album prêté par Sylvain">
      <header><PackageOpen size={25} aria-hidden="true" /><h3>Les Buddies de Sylvain</h3><span>{state.ownedBuddies.length} / 3</span></header>
      <div className={styles.reveal}>{KQ_RELEVE_BUDDIES.map(code => {
        const buddie = KQ_BUDDIES.find(item => item.code === code)!;
        return <div key={code} data-revealed={state.ownedBuddies.includes(code)}><BuddieCard {...buddie} hidden={!state.ownedBuddies.includes(code)} sizes="(max-width: 600px) 25vw, 200px" /></div>;
      })}</div>
      <button type="button" data-releve-guide="buddie-reveal" onClick={() => onAction({ type: "reveal-buddie" })}>Révéler la carte {state.ownedBuddies.length + 1} / 3</button>
      <small>3 cartes prêtées pour l’histoire · tirage préparé</small>
    </section> : <>
      <div className={styles.zones} role="group" aria-label="Zone à planter">{activeZones.map(item => {
        const buddie = KQ_BUDDIES.find(card => card.code === item.buddieCode);
        return <button type="button" key={item.id} data-releve-buddie-zone={item.id} aria-pressed={zone?.id === item.id} onClick={() => setZoneId(item.id)}>
          <Sprout size={20} aria-hidden="true" /><span><strong>{item.name} · {item.width * item.height} m²</strong><small>{buddie?.name ?? "Choisir un Buddie"}</small></span>{buddie && <Check size={17} aria-hidden="true" />}
        </button>;
      })}</div>
      <div data-releve-buddie-selection data-zone={zone?.id}>
        <KqBuddieCarousel buddies={cards} artwork={Object.fromEntries(cards.map(buddie => [buddie.code, { imageUrl: getBuddieArtwork(buddie.code), ownedCopies: 1 }]))}
          selectedCode={zone?.buddieCode ?? ""} rotation={{ requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED, recentBuddieCodes: state.recentBuddieCodes }}
          onInspect={() => { if (!state.milestones.includes("profile-read")) onAction({ type: "mark", milestone: "profile-read" }); }}
          onSelect={code => { if (zone) onAction({ type: "assign", zoneId: zone.id, buddieCode: code }); }} />
      </div>
      <section className={styles.placement} aria-label="Tes Buddies dans l’entrepôt">
        <h3>Tes Buddies dans l’entrepôt</h3>
        <KqWarehousePlan zones={state.draftWarehouse.zones} serviceZones={state.draftWarehouse.serviceZones ?? []}
          dimensions={{ columns: 10, rows: 10 }}
          selectedId={zone?.id ?? null} drawing={false} drawingKind="culture" anchor={null} cursor={{ x: 0, y: 0 }} zoom={zoom}
          interactionHint="Choisis ta zone et sa carte dans le carrousel au-dessus." locked managing={false} growing={false} onZoom={setZoom} onDrawingKind={() => {}} onToggleDrawing={() => {}}
          onSelectPoint={point => { const hit = activeZones.find(item => point.x >= item.x && point.x < item.x + item.width && point.y >= item.y && point.y < item.y + item.height); if (hit) setZoneId(hit.id); }}
          onDrawZone={() => false} onConfigureZone={setZoneId} onCursor={() => {}} onTransformZone={() => {}} onKeyDown={() => {}} />
        <button type="button" data-releve-guide="plan-save" disabled={!dirty} onClick={() => onAction({ type: "save-plan" })}><Save size={18} aria-hidden="true" />{dirty ? "Enregistrer mes Buddies" : "Buddies enregistrés"}</button>
      </section>
    </>}
  </div>;
}
