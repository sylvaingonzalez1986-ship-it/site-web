"use client";

import Image from "next/image";
import { Check, Leaf, LockKeyhole, Pencil, RotateCw, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { createClientRequestKey } from "@/lib/client-request-key";
import { classifyKqBuddieAssignmentReceipt, getKqBuddieAssignmentRequest, type KqBuddieAssignmentSnapshot } from "@/lib/kanab-quest-buddie-assignment";
import { getKqBuddieRotationRemaining, type KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import { registerNavigationGuard } from "@/lib/navigation-guard";
import { KqBuddieCarousel } from "./KqBuddieCarousel";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqCultureBuddies.module.css";

type Props = {
  snapshot: KqBuddieAssignmentSnapshot | null;
  ownedCodes: readonly string[] | null;
  artwork: Record<string, { imageUrl: string; ownedCopies: number }>;
  rotation: KqBuddieRotation | null;
  disabled?: boolean;
  loading?: boolean;
  onSaved: (snapshot: KqBuddieAssignmentSnapshot) => void;
  onBlockedChange: (blocked: boolean) => void;
  onOpenWarehouse: () => void;
  onRefresh: () => void;
};
type AssignmentRequest = ReturnType<typeof getKqBuddieAssignmentRequest>;
type Attempt = { request: AssignmentRequest; body: string; zoneId: string; buddieCode: string | null };
type Status = "idle" | "saving" | "uncertain" | "conflict";

/** Saves a single free assignment. Equipment and warehouse drafts stay untouched. */
export function KqCultureBuddies({ snapshot, ownedCodes, artwork, rotation, disabled = false, loading = false,
  onSaved, onBlockedChange, onOpenWarehouse, onRefresh }: Props) {
  const api = useKqTutorialApi();
  const id = useId();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const mutating = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const requestedRefresh = useRef<{ snapshot: KqBuddieAssignmentSnapshot | null } | null>(null);
  const callbacks = useRef({ onSaved, onBlockedChange });
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const feedback = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const focusZone = useRef<string | null>(null);
  const blocked = status !== "idle";
  useLayoutEffect(() => { callbacks.current = { onSaved, onBlockedChange }; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; callbacks.current.onBlockedChange(false); };
  }, []);
  useEffect(() => { callbacks.current.onBlockedChange(blocked); }, [blocked]);
  useEffect(() => {
    if (!blocked) return;
    const unregister = registerNavigationGuard(() => {
      setNotice(status === "saving" ? "L’affectation est en cours d’enregistrement." : "Vérifie l’affectation avant de quitter cette préparation.");
      feedback.current?.focus();
    });
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { unregister(); window.removeEventListener("beforeunload", beforeUnload); };
  }, [blocked, status]);
  useEffect(() => {
    if (!requestedRefresh.current || !snapshot || requestedRefresh.current.snapshot === snapshot) return;
    const frame = requestAnimationFrame(() => {
      requestedRefresh.current = null;
      attempt.current = null; setStatus("idle"); setError(""); setNotice("Affectations actualisées. Tu peux choisir ton Buddie.");
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot]);
  useEffect(() => {
    if (!selectedZoneId) return;
    const frame = requestAnimationFrame(() => picker.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [selectedZoneId]);
  useEffect(() => {
    if (status !== "idle" || selectedZoneId || disabled || loading || ownedCodes === null || rotation === null || !focusZone.current) return;
    const frame = requestAnimationFrame(() => {
      const trigger = focusZone.current ? triggers.current.get(focusZone.current) : undefined;
      if (!trigger || trigger.disabled) return;
      trigger.focus(); focusZone.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [status, selectedZoneId, disabled, loading, ownedCodes, rotation, snapshot]);

  const zones = snapshot?.state.zones ?? [];
  const assignedZones = zones.filter(zone => zone.active && zone.buddieCode);
  const assignedArea = assignedZones.reduce((area, zone) => area + zone.width * zone.height, 0);
  const selectedZone = zones.find(zone => zone.id === selectedZoneId);
  const selectedIdentity = snapshot && selectedZone ? getKqZoneIdentity(snapshot.state, selectedZone.id) : null;
  const legacyBusy = !!snapshot?.legacyActiveRun || (!!snapshot?.activeRun && !snapshot.activeRuns?.length)
    || !!snapshot?.activeRuns?.some(run => !run.zoneId);
  const occupied = (zoneId: string) => legacyBusy || !!snapshot?.activeRuns?.some(run => run.zoneId === zoneId);
  const buddies = KQ_BUDDIES.filter(buddie => ownedCodes?.includes(buddie.code));
  const unavailableReasons: Record<string, string> = {};
  if (selectedZone) for (const buddie of buddies) {
    const elsewhere = zones.find(zone => zone.id !== selectedZone.id && zone.buddieCode === buddie.code);
    if (elsewhere && snapshot) unavailableReasons[buddie.code] = `Déjà affecté à la ${(getKqZoneIdentity(snapshot.state, elsewhere.id)?.label ?? "zone").toLowerCase()}. Retire cette affectation pour le changer de zone.`;
  }
  const restoreFocus = (zoneId: string) => { focusZone.current = zoneId; };

  async function send(current: Attempt) {
    if (mutating.current) return;
    mutating.current = true; setStatus("saving"); setError(""); setNotice("");
    try {
      const response = await api.request("/api/arena/placard/warehouse", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: current.body,
        signal: AbortSignal.timeout(20_000),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error : "L’affectation n’a pas pu être confirmée.";
        if (response.status >= 400 && response.status < 500) {
          attempt.current = null;
          if (mounted.current) { setStatus(response.status === 409 ? "conflict" : "idle"); setError(message); }
          return;
        }
        throw new Error(message);
      }
      const receipt = classifyKqBuddieAssignmentReceipt(result, current.request);
      if (!receipt) throw new Error("Le reçu d’affectation est incomplet.");
      attempt.current = null;
      if (receipt.status === "changed") {
        if (mounted.current) {
          setStatus("conflict");
          setError("La demande a été enregistrée, puis le plan a changé. Actualise pour vérifier les affectations actuelles.");
        }
        api.notify("kq:equipment-updated");
        return;
      }
      if (mounted.current) {
        setStatus("idle"); setSelectedZoneId(null);
        const name = KQ_BUDDIES.find(buddie => buddie.code === current.buddieCode)?.name;
        setNotice(current.buddieCode ? `${name ?? "Buddie"} affecté. Tu peux poursuivre ta préparation.` : "Affectation retirée. Le Buddie reste dans ta collection.");
        callbacks.current.onSaved(receipt.snapshot); restoreFocus(current.zoneId);
      }
      api.notify("kq:equipment-updated");
    } catch (reason) {
      if (mounted.current) {
        setStatus("uncertain");
        setError(`${reason instanceof Error ? reason.message : "Réponse indisponible."} Réessaie pour vérifier la même demande.`);
      }
    } finally { mutating.current = false; }
  }
  function choose(zoneId: string, buddieCode: string | null) {
    if (!snapshot || disabled || blocked || mutating.current) return;
    try {
      const request = getKqBuddieAssignmentRequest(snapshot, { zoneId, buddieCode }, { ownedCodes, rotation }, createClientRequestKey());
      const current = { request, body: JSON.stringify(request), zoneId, buddieCode };
      attempt.current = current;
      void send(current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Affectation impossible."); }
  }
  function refresh() {
    if (mutating.current || status === "uncertain") return;
    requestedRefresh.current = { snapshot };
    onRefresh();
  }

  return <section className={styles.section} data-culture-buddies aria-labelledby={`${id}-title`} aria-busy={status === "saving"}>
    <header className={styles.header}>
      <div><h2 id={`${id}-title`}>1 · Tes Buddies</h2>
        {snapshot ? <p className={styles.summary} data-culture-buddie-summary><strong>{assignedZones.length}</strong> zone{assignedZones.length > 1 ? "s" : ""} affectée{assignedZones.length > 1 ? "s" : ""} · <strong>{assignedArea} m²</strong></p> : null}
      </div>
      <button type="button" className={styles.secondary} data-preparation-edit-plan disabled={disabled || blocked}
        onClick={onOpenWarehouse}><Pencil size={15} aria-hidden="true" /> Aménager</button>
    </header>
    <p className={styles.intro}>Un Buddie par zone, les mêmes cartes pour toutes. Une zone vide ne participe pas.</p>
    {!snapshot ? <div className={styles.empty}><p>{loading ? "Lecture des zones de culture…" : "Les zones de culture sont indisponibles."}</p><button type="button" disabled={disabled || blocked || loading} onClick={onRefresh}>Actualiser</button></div>
      : !zones.length ? <p className={styles.empty}>Ajoute une zone de culture dans ton entrepôt pour accueillir un Buddie.</p>
        : <div className={styles.zones}>
          {zones.map(zone => {
            const identity = getKqZoneIdentity(snapshot.state, zone.id);
            const label = identity?.label ?? "Zone";
            const buddie = KQ_BUDDIES.find(item => item.code === zone.buddieCode);
            const illustration = zone.buddieCode ? artwork[zone.buddieCode] : undefined;
            const remaining = zone.buddieCode && rotation ? getKqBuddieRotationRemaining(zone.buddieCode, rotation.recentBuddieCodes) : 0;
            const busy = occupied(zone.id);
            const unavailable = disabled || blocked || busy || !zone.active;
            const statusLabel = busy ? "Culture en cours" : !zone.active ? "Zone en pause"
              : !zone.buddieCode ? "À choisir" : ownedCodes === null ? "Collection à vérifier"
                : !ownedCodes.includes(zone.buddieCode) ? "Absent de ta collection" : !rotation ? "Disponibilité à vérifier"
                  : remaining ? `Rotation : encore ${remaining} autre${remaining > 1 ? "s" : ""} Buddie${remaining > 1 ? "s" : ""}` : "Prêt à cultiver";
            return <article key={zone.id} className={styles.zone} data-culture-buddie-zone={zone.id} data-open={selectedZoneId === zone.id || undefined}>
              <div className={styles.illustration} aria-hidden="true">
                {buddie && hasModernBuddieArtwork(buddie.code) ? <BuddieCard code={buddie.code} name={buddie.name} rarity={buddie.rarity} cardNumber={buddie.cardNumber} imageUrl={illustration?.imageUrl} sizes="72px" />
                  : illustration?.imageUrl ? <Image src={illustration.imageUrl} width={72} height={108} alt="" sizes="72px" />
                    : <Leaf size={32} />}
              </div>
              <div className={styles.zoneContent}>
                <p className={styles.zoneName}><span className={styles.zoneNumber} style={{ backgroundColor: identity?.color }} aria-label={label} data-zone-number={identity?.number}>{identity?.number ?? "Zone"}</span><strong>{zone.width * zone.height} m²</strong></p>
                <h3>{buddie?.name ?? (zone.buddieCode ? "Buddie à vérifier" : "Choisis ton Buddie")}</h3>
                <p className={styles.state}>{busy || remaining ? <LockKeyhole size={13} aria-hidden="true" /> : zone.active && zone.buddieCode && rotation && ownedCodes?.includes(zone.buddieCode) ? <Check size={13} aria-hidden="true" /> : null}{statusLabel}</p>
                <div className={styles.actions}>
                  <button type="button" ref={node => { if (node) triggers.current.set(zone.id, node); else triggers.current.delete(zone.id); }}
                    data-culture-buddie-change={zone.id} disabled={unavailable || ownedCodes === null || rotation === null}
                    aria-label={`${zone.buddieCode ? "Changer" : "Choisir"} le Buddie de la ${label.toLowerCase()}`}
                    aria-expanded={selectedZoneId === zone.id} aria-controls={selectedZoneId === zone.id ? `${id}-picker` : undefined}
                    onClick={() => { setSelectedZoneId(previous => previous === zone.id ? null : zone.id); setError(""); setNotice(""); }}>
                    {zone.buddieCode ? "Changer" : "Choisir"}
                  </button>
                  {zone.buddieCode ? <button type="button" className={styles.remove} data-culture-buddie-remove={zone.id}
                    disabled={unavailable || ownedCodes === null || rotation === null} aria-label={`Retirer l’affectation de ${buddie?.name ?? "ce Buddie"} à la ${label.toLowerCase()}`}
                    onClick={() => choose(zone.id, null)}>Retirer</button> : null}
                </div>
              </div>
            </article>;
          })}
        </div>}
    {snapshot && (ownedCodes === null || rotation === null) && !blocked ? <p className={styles.unavailable}>
      {loading ? "Vérification de ta collection et de la rotation…" : ownedCodes === null ? "Ta collection n’a pas pu être vérifiée." : "La rotation des Buddies n’a pas pu être vérifiée."}
      <button type="button" className={styles.secondary} disabled={disabled || loading} onClick={onRefresh}>Actualiser</button>
    </p> : null}
    <div ref={feedback} tabIndex={-1} className={styles.feedback}>
      {status === "saving" ? <p role="status">Enregistrement de l’affectation…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {status === "uncertain" ? <button type="button" data-culture-buddie-retry onClick={() => { if (attempt.current) void send(attempt.current); }}><RotateCw size={15} aria-hidden="true" /> Réessayer la même demande</button> : null}
      {status === "conflict" ? <button type="button" data-culture-buddie-refresh onClick={refresh}><RotateCw size={15} aria-hidden="true" /> Actualiser les affectations</button> : null}
    </div>
    {selectedZone ? <div ref={picker} id={`${id}-picker`} tabIndex={-1} className={styles.picker} data-culture-buddie-picker={selectedZone.id}>
      <div className={styles.pickerBar}><span>{selectedZone.width * selectedZone.height} m² · Affectation gratuite</span><button type="button" className={styles.secondary} disabled={blocked} aria-label="Fermer le choix du Buddie" onClick={() => { setSelectedZoneId(null); restoreFocus(selectedZone.id); }}><X size={15} aria-hidden="true" /> Fermer</button></div>
      <KqBuddieCarousel key={selectedZone.id} id={`${id}-choices`} title={`Un Buddie pour la ${(selectedIdentity?.label ?? "zone").toLowerCase()}`} buddies={buddies} artwork={artwork}
        selectedCode={selectedZone.buddieCode ?? ""} rotation={rotation} compactRotation
        disabled={disabled || blocked || !selectedZone.active || occupied(selectedZone.id) || ownedCodes === null}
        unavailableReasons={unavailableReasons} onSelect={code => choose(selectedZone.id, code)} />
    </div> : null}
  </section>;
}
