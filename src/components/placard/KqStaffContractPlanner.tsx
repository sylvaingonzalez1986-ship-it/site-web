"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { KQ_GAME_MONTH_MS } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CONTRACTS, KQ_STAFF_ROLES, KQ_STAFF_SKILLS, getKqStaffLevel, getKqStaffMonthlyCost } from "@/lib/kanab-quest-staff";
import { getKqStaffContractOptions, getKqStaffRehireBlock, isKqStaffContractHistory } from "@/lib/kanab-quest-staff-contracts";
import type { KqStaffContractKind, KqStaffEmployee, KqStaffSkill, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";
import { isKqStaffSnapshot, type KqStaffConfirmationDraft } from "./KqStaffOperations";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqProgressMeter } from "./KqVisuals";
import desk from "./KqStaffDesk.module.css";
import styles from "./KqStaffContractPlanner.module.css";

const skillKeys = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const money = formatKqCash;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const reasons: Record<KqStaffEmployee["reason"], string> = { permanent: "Emploi permanent", replacement: "Remplacement", "temporary-increase": "Surcroît temporaire d’activité", harvest: "Récolte saisonnière" };
type Prepare = (draft: KqStaffConfirmationDraft) => void;
type FormProps = { employee: KqStaffEmployee; snapshot: KqStaffSnapshot; disabled: boolean; prepare: Prepare };
type Props = {
  contractId: string;
  mode: "manage" | "rehire";
  snapshot: KqStaffSnapshot;
  disabled: boolean;
  prepare: Prepare;
  onSnapshot: (snapshot: KqStaffSnapshot) => boolean;
  onClose: () => void;
  onPayroll: () => void;
};

function PreservedSkills({ employee }: { employee: KqStaffEmployee }) {
  return <details open data-staff-contract-skills><summary>Compétences conservées · {number(skillKeys.reduce((total, skill) => total + employee.skills[skill], 0))} XP</summary>
    <ul className={styles.skills}>{skillKeys.map(skill => <li key={skill} data-staff-contract-skill={skill}><KqProgressMeter label={KQ_STAFF_SKILLS[skill]} value={getKqStaffLevel(employee.skills[skill])} max={10} valueLabel={`Niv. ${getKqStaffLevel(employee.skills[skill])} / 10`} hint={`${number(employee.skills[skill])} XP`} /></li>)}</ul>
  </details>;
}

function ContractHelp({ contract, rehire }: { contract: KqStaffContractKind; rehire?: boolean }) {
  return <details><summary>Règles du contrat</summary><KqHelpDashboard>
    <KqHelpSteps art="help-team" steps={rehire ? [
      { label: "Ancien contrat soldé", detail: "Paie et indemnités réglées.", art: "help-accounts" },
      { label: "Même personne", detail: "Identité, compétences et parcours conservés.", art: "help-team" },
      { label: "Nouveau départ", detail: "Nouvelle paie et nouveaux congés. Semaine type à reprogrammer.", art: "help-plan" },
    ] : [
      { label: "Avant l’échéance", detail: "Confirmer l’avenant avant la fin.", art: "help-time" },
      { label: "Contrat continu", detail: "Embauche, congés, compétences et planning conservés.", art: "help-team" },
      { label: "Sans solde final", detail: "Aucune indemnité versée maintenant.", art: "help-accounts" },
    ]} />
    <KqHelpGrid art="help-plan" items={contract === "cdd" ? [
      { label: "CDD · besoin temporaire", value: "18 mois de jeu max", detail: "Durée totale du contrat.", art: "help-time" },
      { label: "Renouvellements", value: "2 maximum", art: "help-plan" },
      { label: "À la fin", value: "Prime de 10 % du brut cumulé", detail: "+ congés non pris et charges estimées.", art: "help-accounts" },
    ] : contract === "seasonal" ? [
      { label: "Récolte saisonnière", value: "6 mois de jeu max", detail: "Plafond du jeu, pas une règle légale générale.", art: "help-culture" },
      { label: "Renouvellements", value: "2 maximum", art: "help-plan" },
      { label: "À la fin", value: "Sans prime de précarité", detail: "Congés non pris et charges estimées.", art: "help-accounts" },
    ] : [
      { label: "CDI", value: "Sans date de fin", art: "help-time" },
      { label: "Passage direct CDD → CDI", value: "Ancienneté et congés conservés", art: "help-team" },
      { label: "Fin du CDD", value: "Sans prime", art: "help-accounts" },
    ]} />
    <KqHelpNote><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F38" target="_blank" rel="noreferrer">Renouvellement du CDD · Service public</a></KqHelpNote>
  </KqHelpDashboard></details>;
}

function ManageContractForm({ employee, snapshot, disabled, prepare }: FormProps) {
  const options = getKqStaffContractOptions(employee, snapshot.serverNow);
  const [action, setAction] = useState<"renew" | "convert">(options.canRenew ? "renew" : "convert");
  const [months, setMonths] = useState(Math.min(3, Math.max(1, options.remainingMonths)));
  const cost = getKqStaffMonthlyCost(employee, employee.weeklyHours);
  const renewing = action === "renew";
  const durationValid = Number.isSafeInteger(months) && months >= 1 && months <= options.remainingMonths;
  const eligible = renewing ? options.canRenew && durationValid : options.canConvert;
  const newEnd = renewing && durationValid && employee.endsAt ? new Date(Date.parse(employee.endsAt) + months * KQ_GAME_MONTH_MS).toISOString() : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !eligible || !employee.endsAt) return;
    prepare({
      title: renewing ? `Prolonger le contrat de ${employee.name}` : `Passer ${employee.name} en CDI`,
      description: renewing ? "Le même contrat continue. La date d’embauche, les congés acquis, les compétences et le planning sont conservés." : "Le contrat devient un CDI sans interruption. La date d’embauche, les congés acquis, les compétences et le planning sont conservés. Aucune prime de fin de CDD n’est due.",
      rows: [
        ["Contrat", `${renewing ? KQ_STAFF_CONTRACTS[employee.contract] : "CDI"} · ${employee.weeklyHours} h / semaine`],
        ["Échéance actuelle · heure réelle", dateTime(employee.endsAt)],
        ["Nouvelle échéance · heure réelle", newEnd ? dateTime(newEnd) : "Sans date de fin"],
        ...(renewing ? [["Prolongation", `${months} mois de jeu · renouvellement ${options.renewalCount + 1} / ${options.maxRenewals}`], ["Durée totale", `${number(options.totalMonths + months)} / ${options.maxMonths} mois de jeu`]] as Array<[string, string]> : []),
        ["Brut mensuel", money(cost.grossCents)], ["Charges employeur estimées", money(cost.employerCents)],
        ["Coût mensuel récurrent estimé", money(cost.totalCents)], ["Débit immédiat", money(0)],
      ],
      command: renewing ? { action: "renew-contract", employeeId: employee.id, months, expectedEndsAt: employee.endsAt, expectedMonthlyCostCents: cost.totalCents } : { action: "convert-cdi", employeeId: employee.id, expectedEndsAt: employee.endsAt, expectedMonthlyCostCents: cost.totalCents },
      debitCents: 0, confirmLabel: renewing ? "Signer l’avenant" : "Confirmer le CDI",
    });
  }
  return <form onSubmit={submit} className={desk.form} data-staff-contract-form="manage">
    <h3>{employee.name} · {KQ_STAFF_CONTRACTS[employee.contract]}</h3>
    {employee.contract === "cdi" ? <p className={desk.callout}>Ce CDI est déjà sans date de fin.</p> : <>
      <div className={desk.actions} aria-label="Évolution du contrat">
        <button type="button" data-staff-contract-action="renew" aria-pressed={renewing} disabled={disabled || !options.canRenew} onClick={() => setAction("renew")}>Prolonger</button>
        <button type="button" data-staff-contract-action="convert" aria-pressed={!renewing} disabled={disabled || !options.canConvert} onClick={() => setAction("convert")}>Passer en CDI</button>
      </div>
      {options.reason ? <p className={desk.callout} data-staff-contract-limit>{options.reason}</p> : null}
      {renewing && options.canRenew ? <label>Prolongation · mois de jeu<select data-staff-renew-months value={months} disabled={disabled} onChange={event => setMonths(Number(event.target.value))}>{Array.from({ length: options.remainingMonths }, (_, i) => i + 1).map(value => <option key={value} value={value}>{value} mois</option>)}</select></label> : null}
      <KqHelpGrid art="help-plan" items={[
        { label: "Coût mensuel estimé", value: money(cost.totalCents), detail: "Récurrent · brut + charges", art: "help-accounts" },
        { label: "Fin actuelle · heure réelle", value: employee.endsAt ? dateTime(employee.endsAt) : "Sans terme", art: "help-time" },
        { label: "Nouvelle fin · heure réelle", value: newEnd ? dateTime(newEnd) : renewing ? "À choisir" : "Sans terme", art: "help-plan" },
        { label: "Renouvellements utilisés", value: `${options.renewalCount} / ${options.maxRenewals}`, detail: `${number(options.totalMonths)} / ${options.maxMonths} mois de jeu au total`, art: "help-team" },
      ]} />
      <p className={desk.muted}>0 € débité maintenant · salaire et horaires inchangés.</p>
    </>}
    <PreservedSkills employee={employee} />
    <ContractHelp contract={renewing ? employee.contract : "cdi"} />
    {employee.contract !== "cdi" ? <button type="submit" className={desk.primary} data-staff-contract-review disabled={disabled || !eligible}>{renewing ? "Vérifier la prolongation" : "Vérifier le passage en CDI"}</button> : null}
  </form>;
}

function RehireContractForm({ employee, snapshot, disabled, prepare, onPayroll }: FormProps & { onPayroll: () => void }) {
  const accepted = employee.role === "grower" ? employee.contracts.filter(value => value === "cdi") : employee.contracts;
  const [contract, setContract] = useState<KqStaffContractKind>(accepted.includes(employee.contract) ? employee.contract : accepted[0]);
  const [weeklyHours, setWeeklyHours] = useState(employee.role === "grower" ? 35 : employee.weeklyHours);
  const [months, setMonths] = useState(3);
  const [reason, setReason] = useState<"replacement" | "temporary-increase">(employee.reason === "replacement" ? "replacement" : "temporary-increase");
  const cost = getKqStaffMonthlyCost(employee, weeklyHours);
  const durationMonths = contract === "cdi" ? 0 : months;
  const contractReason = contract === "cdi" ? "permanent" : contract === "seasonal" ? "harvest" : reason;
  const block = getKqStaffRehireBlock(snapshot, employee, contract);
  const durations = contract === "seasonal" ? [1, 2, 3, 6] : [3, 6, 12];
  const eligible = accepted.includes(contract) && (contract === "cdi" || durations.includes(months)) && [7, 14, 21, 28, 35].includes(weeklyHours) && (employee.role !== "grower" || weeklyHours === 35);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || block || !eligible) return;
    prepare({
      title: `Réembaucher ${employee.name}`,
      description: "Un nouveau contrat démarre à la confirmation. Cette personne conserve exactement ses compétences, son identité et son parcours. La paie et les congés repartent sur ce contrat ; sa semaine type devra être reprogrammée.",
      rows: [
        ["Contrat", `${KQ_STAFF_CONTRACTS[contract]} · ${weeklyHours} h / semaine`],
        ["Durée", contract === "cdi" ? "Sans date de fin" : `${durationMonths} mois de jeu à partir de la signature`],
        ["Motif", reasons[contractReason]], ["Compétences conservées", `${number(skillKeys.reduce((sum, skill) => sum + employee.skills[skill], 0))} XP · niveaux inchangés`],
        ["Brut mensuel", money(cost.grossCents)], ["Charges employeur estimées", money(cost.employerCents)], ["Coût mensuel récurrent estimé", money(cost.totalCents)],
        ...(contract !== "cdi" ? [["Fin du contrat", contract === "cdd" ? "Prime de 10 % du brut cumulé, congés non pris et charges estimées" : "Congés non pris et charges estimées ; pas de prime de précarité"]] as Array<[string, string]> : []),
        ["Débit à la signature", money(0)],
      ],
      command: { action: "rehire", sourceContractId: employee.id, contract, weeklyHours, durationMonths, reason: contractReason, expectedMonthlyCostCents: cost.totalCents },
      debitCents: 0, confirmLabel: "Signer le nouveau contrat",
    });
  }
  return <form className={desk.form} onSubmit={submit} data-staff-contract-form="rehire" data-staff-rehire-source={employee.id}>
    <h3>{employee.name} · {KQ_STAFF_ROLES[employee.role]}</h3>
    <fieldset className={desk.fields} disabled={disabled}>
      <label>Contrat<select data-staff-rehire-contract value={contract} onChange={event => { setContract(event.target.value as KqStaffContractKind); setMonths(3); }}>{accepted.map(value => <option value={value} key={value}>{KQ_STAFF_CONTRACTS[value]}</option>)}</select></label>
      <label>Heures par semaine<select data-staff-rehire-hours value={weeklyHours} onChange={event => setWeeklyHours(Number(event.target.value))}>{(employee.role === "grower" ? [35] : [7, 14, 21, 28, 35]).map(value => <option value={value} key={value}>{value} h</option>)}</select></label>
      {contract !== "cdi" ? <label>Durée · mois de jeu<select data-staff-rehire-months value={months} onChange={event => setMonths(Number(event.target.value))}>{durations.map(value => <option value={value} key={value}>{value} mois</option>)}</select></label> : null}
      {contract === "cdd" ? <label>Motif temporaire<select data-staff-rehire-reason value={reason} onChange={event => setReason(event.target.value as typeof reason)}><option value="temporary-increase">Surcroît temporaire d’activité</option><option value="replacement">Remplacement</option></select></label> : null}
    </fieldset>
    <KqHelpGrid art="help-team" items={[
      { label: "Coût mensuel estimé", value: money(cost.totalCents), detail: "Récurrent · brut + charges", art: "help-accounts" },
      { label: "À la signature", value: money(0), detail: "Salaire à régler aux échéances", art: "help-accounts" },
      { label: "Nouveau contrat", value: contract === "cdi" ? "Sans terme" : `${durationMonths} mois de jeu`, detail: "Départ à la confirmation", art: "help-plan" },
      { label: "Expérience conservée", value: `${number(skillKeys.reduce((sum, skill) => sum + employee.skills[skill], 0))} XP`, detail: "Niveaux inchangés", art: "help-training" },
    ]} />
    {block ? <p className={desk.callout} role="status" data-staff-rehire-block>{block}</p> : null}
    {snapshot.outstandingCents > 0 ? <button type="button" disabled={disabled} onClick={onPayroll}>Voir les salaires à régler</button> : null}
    <PreservedSkills employee={employee} />
    <ContractHelp contract={contract} rehire />
    <button type="submit" className={desk.primary} data-staff-contract-review disabled={disabled || !!block || !eligible}>Vérifier la réembauche</button>
  </form>;
}

function isRehireSource(value: unknown): value is KqStaffEmployee {
  if (!value || typeof value !== "object") return false;
  const employee = value as KqStaffEmployee;
  return typeof employee.id === "string" && typeof employee.name === "string" && Object.hasOwn(KQ_STAFF_ROLES, employee.role)
    && Object.hasOwn(KQ_STAFF_CONTRACTS, employee.contract) && Array.isArray(employee.contracts) && employee.contracts.length > 0
    && employee.contracts.every(contract => Object.hasOwn(KQ_STAFF_CONTRACTS, contract))
    && (employee.role !== "grower" || employee.contracts.includes("cdi"))
    && [7, 14, 21, 28, 35].includes(employee.weeklyHours) && employee.status === "ended" && employee.finalPaid === true
    && Number.isFinite(Date.parse(employee.hiredAt)) && (employee.endsAt === null || Number.isFinite(Date.parse(employee.endsAt)))
    && Number.isSafeInteger(employee.hourlyCents) && employee.hourlyCents >= 0 && Number.isSafeInteger(employee.classification)
    && skillKeys.every(skill => Number.isFinite(employee.skills?.[skill]) && employee.skills[skill] >= 0)
    && Array.isArray(employee.leave) && !!employee.workDays && isKqStaffContractHistory(employee);
}

function RehireOffer({ contractId, snapshot, disabled, prepare, onSnapshot, onPayroll }: Omit<Props, "mode" | "onClose">) {
  const api = useKqTutorialApi();
  const [offer, setOffer] = useState<{ api: typeof api; employee: KqStaffEmployee; snapshot: KqStaffSnapshot } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await api.request(`/api/arena/placard/staff/rehire?contractId=${encodeURIComponent(contractId)}`, { cache: "no-store", signal: abort.signal });
        const payload: unknown = await response.json();
        if (abort.signal.aborted) return;
        if (!response.ok || !payload || typeof payload !== "object" || !("employee" in payload) || !("snapshot" in payload)
          || !isRehireSource(payload.employee) || !isKqStaffSnapshot(payload.snapshot) || payload.snapshot.context.contractLifecycleVersion !== 1) {
          throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Le dernier dossier de cette personne est indisponible. Réessaie le chargement.");
        }
        if (!onSnapshot(payload.snapshot)) throw new Error("Le registre a changé pendant le chargement. Recharge ce dossier avant de préparer le contrat.");
        setError(""); setOffer({ api, employee: payload.employee, snapshot: payload.snapshot });
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Le dossier est indisponible.");
      } finally { if (!abort.signal.aborted) setLoading(false); }
    }
    void load();
    return () => abort.abort();
  }, [api, contractId, onSnapshot, attempt]);
  useEffect(() => { if (offer) heading.current?.focus({ preventScroll: true }); }, [offer]);
  const currentOffer = offer?.api === api ? offer : null;
  const stale = !!currentOffer && snapshot.revision > currentOffer.snapshot.revision;
  const waiting = loading || !currentOffer && !error;
  function retry() { setOffer(null); setError(""); setLoading(true); setAttempt(value => value + 1); }
  return <div className={styles.offer} aria-busy={waiting}>
    {waiting ? <p role="status" data-staff-rehire-loading>Chargement du dernier contrat et des compétences enregistrées…</p> : null}
    {error || stale ? <div className={desk.error} role="alert" data-staff-rehire-error><p>{error || "Le registre a changé. Recharge le dernier dossier pour préparer la réembauche."}</p><button type="button" disabled={disabled} onClick={retry}>Recharger le dossier</button></div> : null}
    {currentOffer && !waiting && !error && !stale ? <><h3 ref={heading} tabIndex={-1} className={styles.srOnly}>Dernier dossier de {currentOffer.employee.name} chargé</h3><RehireContractForm key={`${currentOffer.employee.id}:${attempt}`} employee={currentOffer.employee} snapshot={snapshot} disabled={disabled} prepare={prepare} onPayroll={onPayroll} /></> : null}
  </div>;
}

export function KqStaffContractPlanner(props: Props) {
  const { contractId, mode, snapshot, disabled, onClose } = props;
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, []);
  const employee = snapshot.state.employees.find(person => person.id === contractId);
  return <section className={`${desk.panel} ${styles.planner}`} data-staff-contract-planner={mode} aria-labelledby={titleId}>
    <header className={desk.sectionHeader}><h2 ref={heading} tabIndex={-1} id={titleId}>{mode === "rehire" ? "Réembaucher une personne" : "Prolonger / CDI"}</h2><button type="button" data-staff-contract-close disabled={disabled} onClick={onClose}>Fermer</button></header>
    {mode === "rehire" ? <RehireOffer {...props} /> : employee ? <ManageContractForm employee={employee} snapshot={snapshot} disabled={disabled} prepare={props.prepare} /> : <p className={desk.callout}>Ce contrat est terminé ou archivé. Consulte « Paie & contrats » pour retrouver son dossier.</p>}
  </section>;
}
