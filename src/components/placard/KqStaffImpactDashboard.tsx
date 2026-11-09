"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { getKqStaffImpact, type KqStaffImpactMetric, type KqStaffImpactMode, type KqStaffImpactSector, type KqStaffImpactSectorId } from "@/lib/kanab-quest-staff-impact";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { KqAllocationBar } from "./KqVisuals";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import { KqStaffPortrait } from "./KqStaffPortrait";
import styles from "./KqStaffImpactDashboard.module.css";

const sectors: Record<KqStaffImpactSectorId, { title: string; art: KqPrintedArtKind; purpose: string }> = {
  culture: { title: "Culture", art: "culture", purpose: "Étapes prises en charge, qualité et rendement" },
  processing: { title: "Transformation", art: "warehouse", purpose: "Cadence et heures disponibles dans l’Atelier" },
  trim: { title: "Trim", art: "help-workshop", purpose: "Fleurs préparées pour la vente" },
  communication: { title: "Communication", art: "help-social", purpose: "Audience et réputation de l’entreprise" },
  sales: { title: "Prospection", art: "help-travel", purpose: "Recherche de nouveaux partenaires" },
  administration: { title: "Administration", art: "help-accounts", purpose: "Remises et gestion des documents" },
  training: { title: "Formation", art: "help-training", purpose: "Progression des compétences" },
};
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const hours = (value: number) => `${number(value)} h`;
function metricValue(metric: KqStaffImpactMetric) {
  if (metric.value !== null) {
    const unit = Math.abs(metric.value) === 1 ? ({ points: "point", étapes: "étape", abonnés: "abonné", tentatives: "tentative", partenaires: "partenaire", documents: "document" } as Record<string, string>)[metric.unit] ?? metric.unit : metric.unit;
    return `${number(metric.value)} ${unit}`;
  }
  if (metric.min !== undefined && metric.max !== undefined) return `${number(metric.min)}–${number(metric.max)} ${metric.unit}`;
  return "Non mesuré";
}
function sectorBenefit(sector: KqStaffImpactSector) {
  const key = { culture: "steps", processing: "efficiency", trim: "trim-capacity", communication: "followers-capacity", sales: "attempts", administration: "discount", training: "xp-" }[sector.id];
  const metric = sector.forecast.find(row => row.id.startsWith(key));
  return metric ? { text: metricValue(metric), label: `Prévision : ${metric.label}` } : null;
}
function Metrics({ items, kind }: { items: KqStaffImpactMetric[]; kind: "actual" | "forecast" }) {
  const label = (metric: KqStaffImpactMetric) => {
    if (kind !== "forecast") return metric.label;
    const bonus = ({ vitality: "Vitalité", terpenes: "Terpènes", yield: "Rendement", cannabinoids: "Cannabinoïdes" } as Record<string, string>)[metric.id];
    if (bonus) return `${bonus} max. / ${metric.label.includes("réserve") ? "réserve" : "mission"}`;
    return ({ steps: "Étapes possibles", "spared-hours": "Tes heures épargnables", "reserved-hours": "Heures réservées", efficiency: "Efficacité", "trim-capacity": "Trim possible", "trim-rate": "Cadence", "followers-capacity": "Abonnés max.", chance: "Réussite / tentative" } as Record<string, string>)[metric.id] ?? metric.label;
  };
  return <dl className={styles.metrics} data-staff-impact-metrics={kind}>{items.map(metric => <div key={metric.id} data-impact-metric={metric.id}>
    <dt>{label(metric)}</dt><dd>{metricValue(metric)}</dd>{kind === "actual" && metric.note ? <small>{metric.note}</small> : null}
  </div>)}</dl>;
}

export function KqStaffImpactDashboard({ snapshot, disabled, stale, onOpenTeam, onOpenDay, onOpenWeekly, onRecruit, children }: {
  snapshot: KqStaffSnapshot; disabled: boolean; stale: boolean;
  onOpenTeam: () => void; onOpenDay: (id: string) => void; onOpenWeekly: (id: string) => void; onRecruit: () => void; children?: ReactNode;
}) {
  const [mode, setMode] = useState<KqStaffImpactMode>(() => snapshot.state.tasks.some(task => task.employeeId !== "player" && task.day === snapshot.calendar.day)
    || !snapshot.state.employees.some(employee => employee.status === "active" && employee.weeklyPlan?.enabled) ? "day" : "week");
  const [person, setPerson] = useState("all");
  const [selectedSector, setSelectedSector] = useState<KqStaffImpactSectorId | null>(null);
  const knownPeople = snapshot.state.employees.filter(employee => employee.status === "active" || mode === "day" && snapshot.state.tasks.some(task => task.employeeId === employee.id && task.day === snapshot.calendar.day));
  const employee = knownPeople.find(row => row.id === person);
  const employeeId = employee?.id ?? null;
  const model = getKqStaffImpact(snapshot, { mode, employeeId });
  const selected = model.sectors.find(sector => sector.id === selectedSector) ?? model.sectors.find(sector => sector.hours.total > 0) ?? model.sectors[0];
  const selectedInfo = sectors[selected.id];
  const rootId = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const sectorNotes = [...new Set([...selected.notes, ...selected.forecast.flatMap(metric => metric.note ? [metric.note] : [])])];
  const activePeople = new Set(selected.contributions.map(contribution => contribution.employeeId));
  const periodLabel = mode === "week" ? "prévues / semaine type" : "affectées aujourd’hui";
  const schedulingAction = !knownPeople.length ? onRecruit : !employee ? onOpenTeam : () => mode === "week" ? onOpenWeekly(employee.id) : onOpenDay(employee.id);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? model.sectors.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + model.sectors.length) % model.sectors.length;
    setSelectedSector(model.sectors[next].id);
    const button = tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }

  return <section className={styles.dashboard} aria-labelledby={`${rootId}-title`} data-staff-benefits-dashboard data-staff-impact-dashboard data-stale={stale || undefined}>
    <header className={styles.heading}><KqPrintedArt kind="staff" sizes="72px" /><div><h2 id={`${rootId}-title`}>Bilan du travail</h2>{stale ? <p>Dernier planning reçu · données à actualiser</p> : null}</div></header>
    <div className={styles.toolbar}>
      <div className={styles.modes} role="group" aria-label="Période des bénéfices">
        <button type="button" data-staff-impact-mode="day" aria-pressed={mode === "day"} onClick={() => setMode("day")}><Clock3 size={16} aria-hidden="true" />Aujourd’hui</button>
        <button type="button" data-staff-impact-mode="week" aria-pressed={mode === "week"} onClick={() => setMode("week")}><CalendarDays size={16} aria-hidden="true" />Semaine type</button>
      </div>
      <span className={styles.period}>{mode === "day" ? `Jour ${snapshot.calendar.day}` : `${model.activePlans} planning${model.activePlans === 1 ? "" : "s"} actif${model.activePlans === 1 ? "" : "s"}${model.pausedPlans ? ` · ${model.pausedPlans} en pause` : ""}`}</span>
    </div>
    <div className={styles.people} role="group" aria-label="Équipe à analyser">
      <button type="button" data-staff-impact-person="all" aria-pressed={!employeeId} onClick={() => setPerson("all")}><UsersRound size={25} aria-hidden="true" /><span>Toute l’équipe</span></button>
      {knownPeople.map(person => <button key={person.id} type="button" data-staff-impact-person={person.id} aria-pressed={employeeId === person.id} onClick={() => setPerson(person.id)}>
        <span className={styles.portrait} aria-hidden="true"><KqStaffPortrait person={person} /></span><span>{person.name}</span>
      </button>)}
    </div>
    <div className={styles.summary}>
      <div className={styles.total} data-staff-impact-hours data-hours={model.hours.total}><strong>{hours(model.hours.total)}</strong><span>{periodLabel}</span></div>
      <div className={styles.allocation}>{model.hours.total > 0 ? <KqAllocationBar label="Répartition du temps par secteur" items={model.sectors.filter(sector => sector.hours.total > 0).map(sector => ({ label: sectors[sector.id].title, value: sector.hours.total, displayValue: hours(sector.hours.total) }))} />
        : <p>{!knownPeople.length ? "Recrute un salarié pour partager le travail." : mode === "week" ? model.pausedPlans ? "Les semaines types en pause ne lancent aucune mission." : "Aucune semaine type active pour cette sélection." : "Aucune tâche salariée enregistrée pour aujourd’hui."}</p>}</div>
    </div>
    {mode === "day" && model.hours.total > 0 ? <dl className={styles.hourStates}>
      <div><dt>Utilisées / terminées</dt><dd>{hours(model.hours.completed)}</dd></div>
      <div><dt>En mission</dt><dd>{hours(model.hours.running)}</dd></div>
      <div><dt>Réserves utilisables</dt><dd>{hours(model.hours.remaining)}</dd></div>
      {model.hours.unused > 0 ? <div><dt>Réserves expirées inutilisées</dt><dd>{hours(model.hours.unused)}</dd></div> : null}
      {model.hours.unknown > 0 ? <div><dt>Utilisation non mesurée</dt><dd>{hours(model.hours.unknown)}</dd></div> : null}
    </dl> : null}
    <div ref={tabs} className={styles.sectors} role="tablist" aria-label="Bénéfices par secteur">{model.sectors.map((sector, index) => {
      const benefit = sectorBenefit(sector);
      return <button key={sector.id} id={`${rootId}-${sector.id}`} type="button" role="tab"
      aria-selected={sector.id === selected.id} aria-controls={`${rootId}-panel`} tabIndex={sector.id === selected.id ? 0 : -1} data-staff-impact-sector={sector.id} onKeyDown={event => moveTab(event, index)} onClick={() => setSelectedSector(sector.id)}>
      <KqPrintedArt kind={sectors[sector.id].art} sizes="52px" /><strong>{sectors[sector.id].title}</strong><span>{hours(sector.hours.total)}</span>
      {benefit ? <small aria-label={`${benefit.label} : ${benefit.text}`}>{benefit.text} · potentiel</small> : null}
    </button>})}</div>
    <section id={`${rootId}-panel`} className={styles.panel} role="tabpanel" aria-labelledby={`${rootId}-${selected.id}`} tabIndex={0} data-staff-impact-panel data-sector={selected.id} data-hours={selected.hours.total}>
      <div className={styles.panelHeading}><div><h3>{selectedInfo.title}</h3><p>{selectedInfo.purpose}</p></div><strong>{hours(selected.hours.total)} <span>{mode === "week" ? "/ semaine" : "aujourd’hui"}</span></strong></div>
      {!selected.contributions.length ? <p className={styles.empty}>Aucun créneau {selectedInfo.title.toLocaleLowerCase("fr")} {mode === "week" ? "dans les semaines types actives" : "dans les tâches du jour"}.</p> : <>
        <div className={styles.outcomes}>
          <div className={styles.forecast}><h4>{mode === "week" ? "Potentiel du planning" : "Potentiel du travail restant"}</h4>
            {selected.forecast.length ? <Metrics items={selected.forecast} kind="forecast" /> : <p>Aucun gain restant chiffrable pour ces créneaux.</p>}
            <p className={styles.estimate}>Prévision selon les compétences et les conditions actuelles.</p>
          </div>
          {mode === "day" ? <div className={styles.actual}><h4>Confirmé aujourd’hui</h4>{selected.actual.length ? <Metrics items={selected.actual} kind="actual" /> : <p>Aucun résultat confirmé pour ces créneaux.</p>}</div> : null}
        </div>
        {!employeeId ? <ul className={styles.contributors} aria-label={`Équipe en ${selectedInfo.title.toLocaleLowerCase("fr")}`}>{[...activePeople].map(id => {
          const person = knownPeople.find(row => row.id === id);
          const contributedHours = selected.contributions.filter(row => row.employeeId === id).reduce((sum, row) => sum + row.hours.total, 0);
          return <li key={id}>{person ? <span className={styles.smallPortrait} aria-hidden="true"><KqStaffPortrait person={person} /></span> : null}<span>{person?.name ?? selected.contributions.find(row => row.employeeId === id)?.name}<strong>{hours(contributedHours)}</strong></span></li>;
        })}</ul> : null}
        {selected.warnings?.length ? <ul className={styles.conditions}>{selected.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
        {sectorNotes.length ? <details className={styles.rules}><summary>Conditions et limites</summary><ul>{sectorNotes.map(note => <li key={note}>{note}</li>)}</ul></details> : null}
      </>}
    </section>
    <div className={styles.bottom}><p>{mode === "week" ? "Modèles enregistrés et actifs. Les gains restent conditionnels ; les créneaux impossibles peuvent être ignorés au départ." : "Les résultats concernent les tâches salariées enregistrées ce jour."}</p>
      <button type="button" data-staff-impact-plan disabled={disabled || stale || employee?.status === "ended"} onClick={schedulingAction}>{!knownPeople.length ? "Recruter" : !employee ? "Répartir le travail" : mode === "week" ? "Modifier sa semaine" : "Organiser sa journée"}<ArrowRight size={16} aria-hidden="true" /></button></div>
    {model.notes.length ? <details className={styles.rules}><summary>À prendre en compte ({model.notes.length})</summary><ul>{model.notes.map(note => <li key={note}>{note}</li>)}</ul></details> : null}
    {children}
  </section>;
}
