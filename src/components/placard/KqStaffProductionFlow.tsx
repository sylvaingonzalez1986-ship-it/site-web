"use client";

import { useId, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Hand, Hourglass, PackageOpen, Scissors, Sprout, Store, PanelsTopLeft } from "lucide-react";
import { getKqStaffCapacity, getKqStaffLevel } from "@/lib/kanab-quest-staff";
import { KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY, KQ_PRODUCTION_DRYING_MS } from "@/lib/kanab-quest-staff-production";
import type { KqProductionLot, KqProductionStep } from "@/lib/kanab-quest-staff-production-types";
import type { KqStaffEmployee, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqStaffProductionFlow.module.css";

type Stage = KqProductionLot["stage"];
const stages: { id: Stage; name: string; step: Exclude<KqProductionStep, "auto">; description: string }[] = [
  { id: "culture", name: "Culture", step: "culture", description: "Trois gestes de culture, avec une attente entre les jalons. La qualité et la récolte seront connues à la fin." },
  { id: "drying", name: "Maturation", step: "trim", description: "Six heures réelles de maturation après récolte. Ce temps passe sans mobiliser de salarié." },
  { id: "trim", name: "Trim", step: "trim", description: "Les fleurs sont préparées à la main. La compétence Transformation détermine la cadence et la qualité du trim." },
  { id: "processing", name: "Tamisage", step: "processing", description: "Le tamis transforme les fleurs en hash. Les grammes affichés suivent les fleurs entrantes ; le rendement final dépend du salarié." },
  { id: "ready", name: "Vente", step: "sell", description: "Les produits prêts attendent un créneau de vente. Le prix dépend de la qualité et de la compétence Vente du salarié." },
];
const n = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const lotsLabel = (count: number) => `${count} lot${count > 1 ? "s" : ""}`;
const stageIcons = { culture: Sprout, drying: Hourglass, trim: Scissors, processing: PanelsTopLeft, ready: Store };

function availability(employee: KqStaffEmployee, snapshot: KqStaffSnapshot) {
  if (employee.leave.some(leave => snapshot.calendar.day >= leave.startDay && snapshot.calendar.day <= leave.endDay)) return "En congé";
  const capacity = getKqStaffCapacity(employee, snapshot.calendar);
  if (snapshot.calendar.weekend || capacity.baseHours === 0) return "Repos prévu au contrat";
  return `${n(capacity.remainingHours)} h disponibles aujourd’hui`;
}

export function KqStaffProductionFlow({ snapshot, disabled, employeeId, onEmployee, onAssign, onWeekly }: {
  snapshot: KqStaffSnapshot; disabled: boolean; employeeId: string;
  onEmployee: (id: string) => void; onAssign: (step: KqProductionStep) => void; onWeekly: (id: string) => void;
}) {
  const production = snapshot.state.production;
  const [selected, setSelected] = useState<Stage>(production?.lots[0]?.stage ?? "culture");
  const panelId = useId(), headingId = useId();
  const station = stages.find(stage => stage.id === selected)!;
  const lots = production?.lots.filter(lot => lot.stage === selected) ?? [];
  const employees = snapshot.state.employees.filter(employee => employee.status === "active");
  const selectedEmployee = employees.find(employee => employee.id === employeeId);
  const hashRoute = production?.settings.route === "dry-sift";
  const unused = selected === "processing" && !hashRoute;
  const now = Date.parse(snapshot.serverNow);
  const demand = production?.demand.day === snapshot.calendar.day ? production.demand.reservedGrams : 0;
  const action = selected === "drying" ? "Organiser le trim" : `Préparer ${selected === "ready" ? "une vente" : `un créneau ${station.name}`}`;

  return <div className={styles.flow} data-production-flow>
    <p className={styles.route} data-production-route>
      <PackageOpen size={18} aria-hidden="true" />
      {hashRoute ? "Fleurs → trim → hash → vente" : "Fleurs → trim → vente"}
      <span>Lots commerciaux · aucun point</span>
    </p>
    <KqPrintedArt kind="staff-production" className={styles.panorama} sizes="(max-width: 680px) 100vw, 1100px" />
    <div className={styles.stations} role="group" aria-label="Étapes de la production autonome">
      {stages.map((stage, index) => {
        const count = production?.lots.filter(lot => lot.stage === stage.id).length ?? 0;
        const running = production?.jobs.filter(job => job.step === stage.step && stage.id !== "drying" && Date.parse(job.startedAt) <= now && Date.parse(job.completesAt) > now).length ?? 0;
        const skipped = stage.id === "processing" && !hashRoute;
        const Icon = stageIcons[stage.id];
        return <button type="button" key={stage.id} data-production-stage={stage.id} data-unused={skipped || undefined}
          aria-pressed={selected === stage.id} aria-controls={panelId} onClick={() => setSelected(stage.id)}>
          <Icon size={23} aria-hidden="true" />
          <span className={styles.stationName}>{index + 1}. {stage.name}{selected === stage.id ? <Check size={15} aria-hidden="true" /> : null}</span>
          <strong>{skipped ? "Filière hash" : production ? lotsLabel(count) : "À configurer"}</strong>
          <small>{skipped ? "Non utilisé" : running ? `${running} geste${running > 1 ? "s" : ""} en cours` : stage.id === "drying" && count ? "Temps passif" : count ? "À suivre" : "Poste libre"}</small>
        </button>;
      })}
    </div>
    <section id={panelId} aria-labelledby={headingId} className={styles.detail} data-production-stage-panel={selected}>
      <div className={styles.detailHeading}><h3 id={headingId}>{station.name}</h3><span>{unused ? "Non utilisé pour les fleurs" : lotsLabel(lots.length)}</span></div>
      <p>{unused ? "Les fleurs préparées passent directement du trim à la vente. Le tamisage intervient dans la filière Hash tamisé." : station.description}</p>
      {selected === "ready" && production ? <KqProgressMeter label="Demande réservée aujourd’hui" value={demand} max={KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY}
        valueLabel={`${n(demand)} / ${KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY} g équivalent fleur`} hint="Commune à tous les employés. Une réservation en cours n’est pas encore une vente encaissée." /> : null}
      {lots.length ? <div className={styles.lots}>{lots.map(lot => {
        const job = production!.jobs.find(item => item.lotId === lot.id);
        const worker = job ? snapshot.state.employees.find(employee => employee.id === job.employeeId) : null;
        const waiting = (lot.stage === "culture" || lot.stage === "drying") && Date.parse(lot.readyAt) > now;
        const skill = selected === "culture" ? "culture" : selected === "ready" ? "sales" : "processing";
        return <article key={lot.id} className={styles.lot} data-production-lot={lot.id}>
          <div className={styles.lotHeading}><h4>Lot {lot.id.split("-").at(-1)}</h4><strong>{lot.stage === "culture" ? `${n(lot.potentialGrams)} g réservés` : `${n(lot.grams)} g ${lot.stage === "ready" && lot.route === "dry-sift" ? "de hash" : "de fleurs"}`}</strong></div>
          {lot.stage === "culture" ? <KqProgressMeter label={`Gestes de culture · ${lot.cultureStage} / 3 jalons terminés`} value={lot.cultureHours} max={3 * (production!.facility?.areaM2 ?? 0)} valueLabel={`${n(lot.cultureHours)} / ${n(3 * (production!.facility?.areaM2 ?? 0))} h confirmées`} />
            : lot.stage === "drying" ? <KqProgressMeter label="Maturation passive" value={Math.max(0, Math.min(KQ_PRODUCTION_DRYING_MS, now - (Date.parse(lot.readyAt) - KQ_PRODUCTION_DRYING_MS)))} max={KQ_PRODUCTION_DRYING_MS} valueLabel={waiting ? `Prête le ${date(lot.readyAt)}` : "Échéance atteinte · actualisation nécessaire"} />
              : lot.stage === "trim" || lot.stage === "processing" ? <KqProgressMeter label={lot.stage === "trim" ? "Fleurs trimées" : "Fleurs tamisées"} value={(lot.stage === "trim" ? lot.grams : lot.equivalentGrams) - lot.remainingWork} max={lot.stage === "trim" ? lot.grams : lot.equivalentGrams}
                valueLabel={`${n((lot.stage === "trim" ? lot.grams : lot.equivalentGrams) - lot.remainingWork)} / ${n(lot.stage === "trim" ? lot.grams : lot.equivalentGrams)} g confirmés`} /> : null}
          {lot.stage !== "culture" ? <p className={styles.quality}>Qualité {lot.stage === "trim" || lot.stage === "processing" ? "actuelle" : "commerciale"} : <strong>{n(lot.quality)} / 100</strong></p> : <p className={styles.quality}>Récolte et qualité encore inconnues.</p>}
          {job ? <div className={styles.worker} data-production-job={job.id}>
            {worker ? <span className={styles.portrait}><KqStaffPortrait person={worker} /></span> : <Hand size={24} aria-hidden="true" />}
            <span><strong>{worker?.name ?? "Employé"} · niv. {job.skillLevel}</strong><small>{skill === "culture" ? "Culture" : skill === "sales" ? "Vente" : "Transformation"} · fin du geste le {date(job.completesAt)}</small><small>Le geste en cours sera compté à sa fin.</small></span>
          </div> : <p className={styles.waiting}><Clock3 size={17} aria-hidden="true" />{waiting ? `Attente jusqu’au ${date(lot.readyAt)} · heure réelle` : "En attente d’un créneau compatible"}</p>}
        </article>;
      })}</div> : !unused ? <p className={styles.empty}>{!production ? "Configure une zone dédiée pour engager le premier cycle." : selected === "culture" ? "Aucun lot en culture. Un créneau Culture ou Chaîne complète peut lancer un cycle si les règles et l’espace le permettent." : "Aucun lot à cette étape pour le moment."}</p> : null}
      {!unused && production?.facility ? <div className={styles.assignment}>
        {employees.length ? <>
          <div className={styles.people} role="group" aria-label="Choisir un employé pour ce poste">
            {employees.map(employee => {
              const skill = selected === "culture" ? "culture" : selected === "ready" ? "sales" : "processing";
              const level = Math.min(10, getKqStaffLevel(employee.skills[skill]) + (employee.trait === "versatile" ? 1 : 0));
              return <button type="button" key={employee.id} data-production-employee={employee.id} aria-pressed={employeeId === employee.id} disabled={disabled} onClick={() => onEmployee(employee.id)}>
                <span className={styles.portrait}><KqStaffPortrait person={employee} /></span><span><strong>{employee.name}</strong><small>{selected === "culture" ? "Culture" : selected === "ready" ? "Vente" : "Transformation"} · niv. {level}</small><small>{availability(employee, snapshot)}</small></span>
              </button>;
            })}
          </div>
          <div className={styles.actions}><button type="button" disabled={disabled || !selectedEmployee} onClick={() => onAssign(station.step)}><ArrowRight size={17} aria-hidden="true" />{action}</button><button type="button" disabled={disabled || !selectedEmployee} onClick={() => onWeekly(employeeId)}><CalendarDays size={17} aria-hidden="true" />Planifier la semaine</button></div>
          <p className={styles.note}>{selectedEmployee ? `Pour ${selectedEmployee.name}. ` : ""}{selected === "drying" ? "Le trim attend la fin de la maturation et un créneau encore ouvert. Pour un jour ultérieur, utilise le planning de la semaine." : "Choisir un poste ou un salarié ne réserve aucune heure. Vérifie le créneau avant de confirmer."}</p>
        </> : <p>Recrute un salarié dans Personnel pour organiser les créneaux.</p>}
      </div> : null}
    </section>
  </div>;
}
