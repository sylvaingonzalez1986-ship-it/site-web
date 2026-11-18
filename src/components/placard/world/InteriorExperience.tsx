"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { registerNavigationGuard } from "@/lib/navigation-guard";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseDimensions } from "@/lib/kanab-quest-warehouse";
import { WarehouseBuildMenu, type WarehouseBuildCell } from "./WarehouseBuildMenu";
import { createInteriorRoom } from "./interior-rooms";
import { useInteriorWarehouse } from "./useInteriorWarehouse";
import type { VillageBuildingKind } from "./village-buildings";
import type { InteriorObject, InteriorQuality } from "./interior-types";
import styles from "./InteriorExperience.module.css";

const Scene = dynamic(() => import("./InteriorCanvas"), { ssr: false, loading: () => <p className={styles.loading} role="status">Ouverture du lieu…</p> });
class InteriorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function InteriorExperience({ id, suspended, onNavigate, onExit }: {
  id: VillageBuildingKind; suspended: boolean; onNavigate: (href: string) => void; onExit: () => void;
}) {
  const warehouse = useInteriorWarehouse(id === "warehouse", suspended);
  const room = useMemo(() => createInteriorRoom(id, warehouse.snapshot), [id, warehouse.snapshot]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [overhead, setOverhead] = useState(false);
  const [grid, setGrid] = useState(true);
  const [quality, setQuality] = useState<InteriorQuality>("auto");
  const [sensitivity, setSensitivity] = useState(1);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [buildMenu, setBuildMenu] = useState(false);
  const [cell, setCell] = useState<WarehouseBuildCell | null>(null);
  const navigation = useRef<(() => void) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const onReady = useCallback(() => setReady(true), []);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  const selected = room.objects.find(object => object.id === selectedId);
  const preview: InteriorObject | null = warehouse.item ? { ...warehouse.item, label: warehouse.item.name, movable: true, active: room.objects.find(object => object.id === warehouse.item!.id)?.active ?? false } : null;
  const focusedId = warehouse.dirty ? warehouse.selectedId : selectedId;
  const dimensions = warehouse.snapshot ? getKqWarehouseDimensions(warehouse.snapshot.state) : { columns: 10, rows: 10 };

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const check = () => setOverlayOpen(!!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'));
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal"] });
    check(); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!warehouse.dirty && !warehouse.pending) return;
    const cleanup = registerNavigationGuard(action => { navigation.current = action; setLeaveOpen(true); });
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { cleanup(); window.removeEventListener("beforeunload", warn); };
  }, [warehouse.dirty, warehouse.pending]);

  const interact = (objectId: string) => {
    if (warehouse.dirty || warehouse.pending) return;
    const object = room.objects.find(object => object.id === objectId);
    if (object?.kind === "exit") onExit();
    else if (object?.kind === "partition") { setSelectedId(object.id); setEditing(true); setOverhead(true); setBuildMenu(true); }
    else if (object?.href) onNavigate(object.href);
  };
  const choose = (objectId: string) => {
    if (!warehouse.dirty) setSelectedId(objectId);
    if (editing && !warehouse.pending) setBuildMenu(true);
  };
  const pickCell = (x: number, z: number) => {
    if (!editing || warehouse.pending || warehouse.loading || warehouse.uncertain || warehouse.conflict) return;
    const next = { x: Math.floor(x + dimensions.columns / 2), y: Math.floor(z + dimensions.rows / 2) };
    if (next.x < 0 || next.y < 0 || next.x >= dimensions.columns || next.y >= dimensions.rows) return;
    setCell(next);
    if (warehouse.dirty) warehouse.place(x, z);
    else {
      const occupied = room.objects.find(object => object.movable && Math.abs(x - object.x) < object.width / 2 + 0.001 && Math.abs(z - object.z) < object.depth / 2 + 0.001);
      setSelectedId(occupied?.id ?? null);
    }
    setBuildMenu(true);
  };
  const canEdit = !!warehouse.snapshot && !warehouse.loading;
  const frozen = warehouse.pending || warehouse.uncertain || warehouse.conflict;

  return <div className={styles.root} data-interior={id} data-interior-ready={ready || undefined} data-interior-editing={editing || undefined} data-interior-overhead={overhead || undefined} data-interior-draft={warehouse.dirty || undefined} hidden={suspended}>
    {!unavailable ? <InteriorBoundary onError={onUnavailable}><Scene room={room} suspended={suspended || overlayOpen || warehouse.pending || warehouse.loading} editing={editing} overhead={overhead} grid={grid} sensitivity={sensitivity} quality={quality}
      selectedId={focusedId} preview={preview} previewValid={!warehouse.validation.length} onSelect={choose} onInteract={interact}
      selectedCell={cell ? { x: cell.x + .5 - dimensions.columns / 2, z: cell.y + .5 - dimensions.rows / 2 } : null} onPlace={pickCell} onExit={onExit} onReady={onReady} onUnavailable={onUnavailable} /></InteriorBoundary> : null}
    <div className={styles.top}>
      <h2 ref={heading} tabIndex={-1}>{room.name}</h2>
      <button type="button" onClick={onExit}>Au village</button>
      {id === "warehouse" && <button type="button" aria-pressed={editing} disabled={!canEdit || warehouse.dirty} data-interior-build-toggle onClick={() => { const next = !editing; setEditing(next); setOverhead(next); setGrid(true); setSelectedId(null); setCell(null); setBuildMenu(false); }}>{editing ? "Terminer" : "Aménager"}</button>}
      <details className={styles.settings}><summary>Commandes et qualité</summary><div>
        <p>ZQSD / WASD ou flèches : avancer. Glisser : regarder. E : agir. Échap : libérer la souris. Les commandes tactiles sont en bas de l’écran.</p>
        <label>Sensibilité du regard <input type="range" min="0.3" max="2" step="0.1" value={sensitivity} onChange={event => setSensitivity(Number(event.target.value))} /></label>
        <label>Qualité <select value={quality} onChange={event => setQuality(event.target.value as InteriorQuality)}><option value="auto">Automatique</option><option value="high">Élevée</option><option value="low">Réduite</option></select></label>
        <p>Les actions et leurs coûts restent disponibles dans les panneaux.</p>
      </div></details>
    </div>
    {unavailable && <p className={styles.fallback} role="alert">La vue 3D est indisponible. Les activités ci-dessous restent accessibles ; tu peux aussi choisir « Vue 2D ».</p>}
    {!ready && !unavailable ? <p className={styles.loading} role="status">Préparation de l’intérieur…</p> : null}
    {!editing && <aside className={styles.inspector} aria-label="Activités du lieu">
      {id === "warehouse" && <div className={styles.balance}>
        {warehouse.loading ? <span role="status">Chargement de ton plan…</span> : warehouse.snapshot ? <><strong>{formatKqCash(warehouse.snapshot.cashCents)}</strong><span>{dimensions.columns * dimensions.rows} m² · {warehouse.snapshot.state.zones.length} zones de culture</span></> : <button type="button" onClick={() => void warehouse.reload()}>Réessayer le chargement</button>}
      </div>}
      <label className={styles.destination}>Choisir un objet<select aria-label="Objet du lieu" value={focusedId ?? ""} disabled={warehouse.dirty} onChange={event => choose(event.target.value)}>
        <option value="">Objets et activités</option>{room.objects.map(object => <option key={object.id} value={object.id}>{object.label}</option>)}
      </select></label>
      {selected && !warehouse.dirty && <div className={styles.selection}>
        <h3>{selected.label}</h3>{selected.detail && <p>{selected.detail}</p>}
        <button type="button" onClick={() => interact(selected.id)}>{selected.kind === "exit" ? "Sortir" : "Ouvrir les actions"}</button>
      </div>}
      {warehouse.error && <p className={styles.error} role="alert">{warehouse.error}</p>}
      {(warehouse.conflict || warehouse.uncertain) && <><p>L’aperçu est conservé. Recharge le plan pour vérifier l’état enregistré avant de continuer.</p><button type="button" disabled={warehouse.pending} onClick={() => setReloadOpen(true)}>Recharger le plan enregistré</button></>}
      {warehouse.notice && <p role="status">{warehouse.notice}</p>}
      {!selected && !warehouse.dirty && <p>Approche d’un objet puis appuie sur E, ou sélectionne-le ici pour ouvrir ses actions.</p>}
    </aside>}
    {editing && <aside className={styles.buildBar} aria-label="Aménagement de l’entrepôt">
      <p>{warehouse.dirty ? warehouse.validation[0] ?? "Aperçu prêt. Confirme ou clique sur une autre case pour le déplacer." : "Clique sur une case pour choisir Culture, Stockage, Séchage ou Paroi."}</p>
      <div className={styles.buildBarActions}>
        <button type="button" aria-pressed={overhead} onClick={() => setOverhead(value => !value)}>{overhead ? "Explorer en 3D" : "Vue de dessus"}</button>
        {warehouse.dirty && <><button type="button" data-build-resume onClick={() => setBuildMenu(true)}>Reprendre l’aménagement</button><button type="button" disabled={warehouse.pending || warehouse.uncertain} onClick={warehouse.cancel}>Annuler</button></>}
        <details className={styles.cellPicker}><summary>Choisir une case au clavier</summary>
          <form onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            pickCell(Number(data.get("column")) - .5 - dimensions.columns / 2, Number(data.get("row")) - .5 - dimensions.rows / 2);
            event.currentTarget.closest("details")?.removeAttribute("open");
          }}>
            <label>Colonne<input name="column" type="number" min="1" max={dimensions.columns} defaultValue={1} required /></label>
            <label>Ligne<input name="row" type="number" min="1" max={dimensions.rows} defaultValue={1} required /></label>
            <button type="submit" disabled={frozen}>Choisir cette case</button>
          </form>
        </details>
      </div>
      {!buildMenu && warehouse.error && <p className={styles.error} role="alert">{warehouse.error}</p>}
      {warehouse.notice && <p role="status">{warehouse.notice}</p>}
    </aside>}
    <WarehouseBuildMenu open={buildMenu} cell={cell} selected={selected} warehouse={warehouse} onClose={() => setBuildMenu(false)} onNavigate={onNavigate} onReload={() => setReloadOpen(true)} />
    <AppDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Aménagement en cours" className={styles.dialog}>
      <p>{warehouse.pending ? "Attends la réponse du serveur avant de quitter." : warehouse.uncertain ? "Le résultat de la confirmation est incertain. Vérifie le plan enregistré avant de quitter." : "Cet aperçu n’est pas encore enregistré. Reviens le confirmer ou annule-le pour quitter."}</p>
      <button type="button" onClick={() => setLeaveOpen(false)}>Revenir à l’aménagement</button>
      {!frozen && <button type="button" onClick={() => { warehouse.cancel(); setLeaveOpen(false); const next = navigation.current; navigation.current = null; next?.(); }}>Annuler l’aperçu et quitter</button>}
    </AppDialog>
    <AppDialog open={reloadOpen} onClose={() => setReloadOpen(false)} title="Vérifier le plan enregistré" className={styles.dialog}>
      <p>L’aperçu sera abandonné. Le plan confirmé par le serveur sera rechargé, avec tes équipements et activités actuels.</p>
      <button type="button" onClick={() => setReloadOpen(false)}>Garder l’aperçu</button><button type="button" onClick={() => { setReloadOpen(false); void warehouse.reload(); }}>Recharger</button>
    </AppDialog>
  </div>;
}
