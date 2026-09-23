"use client";

import Image from "next/image";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarClock, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, FileText, Landmark, LoaderCircle, ReceiptText, RefreshCw, Search, Settings2, Wallet } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqBusinessClock } from "@/lib/kanab-quest-business";
import { KQ_TREASURY_ACCOUNTS, KQ_TREASURY_EXPENSE_ACCOUNTS, KQ_TREASURY_REVENUE_ACCOUNTS, KQ_TREASURY_PERIODS, getKqTreasuryEntryLabel, getKqTreasuryReport, isKqTreasurySnapshot, type KqTreasuryAccount, type KqTreasuryEntry, type KqTreasuryLine, type KqTreasuryPeriod, type KqTreasurySnapshot } from "@/lib/kanab-quest-treasury";
import { KqTreasuryManagement } from "./KqTreasuryManagement";
import { KqTreasuryBank } from "./KqTreasuryBank";
import styles from "./KqTreasuryDesk.module.css";

const TABS = [
  { id: "invoices", label: "Factures & échéances", icon: ReceiptText },
  { id: "overview", label: "Synthèse", icon: ChartNoAxesCombined },
  { id: "accounts", label: "Bilan et résultat", icon: FileText },
  { id: "journal", label: "Journal", icon: Wallet },
  { id: "chartOfAccounts", label: "Plan comptable", icon: BookOpen },
] as const;
type Tab = typeof TABS[number]["id"];
const POLES = [
  { id: "accounting", number: "01", label: "Comptabilité", description: "Factures, comptes & journal", icon: BookOpen },
  { id: "bank", number: "02", label: "Banque", description: "Placements & financement", icon: Landmark },
  { id: "management", number: "03", label: "Gestion", description: "Site, publicité & domiciliation", icon: Settings2 },
] as const;
type Pole = typeof POLES[number]["id"];
const OFFICE_ART: Record<Pole, { src: string; alt: string; caption: string }> = {
  accounting: { src: "/placard/bureau-accounting-v1.webp", alt: "Au bureau comptable du Placard, les factures sont classées dans un grand registre", caption: "Le registre est ouvert. On fait les comptes ?" },
  bank: { src: "/placard/bureau-bank-v1.webp", alt: "Le banquier du Placard, cigare à la main et pieds sur son bureau, examine les dossiers", caption: "La confiance se cultive. Le crédit aussi." },
  management: { src: "/placard/bureau-management-v1.webp", alt: "Le bureau de gestion du Placard avec les projets du shop et ses campagnes publicitaires", caption: "Un projet à la fois. Une entreprise qui grandit." },
};
type Report = ReturnType<typeof getKqTreasuryReport>;
const money = formatKqCash;
const shortDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fullDate = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${money(Math.abs(cents))}`;

function TreasuryClock({ startedAt, serverNow }: { startedAt: string; serverNow: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const received = performance.now();
    const timer = window.setInterval(() => setElapsed(Math.max(0, performance.now() - received)), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = getKqBusinessClock(startedAt, Date.parse(serverNow) + elapsed);
  return <span className={styles.clock}><CalendarClock size={19} aria-hidden="true" /><span><strong>Mois {clock.month} · Jour {clock.dayOfMonth}</strong><small>1 jour = 4 h réelles · 1 mois = 5 jours réels</small></span></span>;
}

function CashChart({ data }: { data: KqTreasurySnapshot }) {
  const [mode, setMode] = useState<"balance" | "flows">("balance");
  const [selected, setSelected] = useState(Math.max(0, data.series.length - 1));
  const points = data.series;
  if (!points.length) return <section className={styles.card}><h2>Évolution de la trésorerie</h2><p>Aucune période enregistrée pour cette sélection.</p></section>;
  const index = Math.min(selected, points.length - 1), active = points[index];
  const highest = Math.max(100, ...points.map(point => mode === "balance" ? Math.max(point.cashOpeningCents, point.cashClosingCents) : Math.max(point.inflowsCents, point.outflowsCents)));
  const maximum = Math.ceil(highest / 100) * 100;
  const height = 200, width = 640, pad = 12, bottom = height - pad;
  const x = (position: number) => pad + (points.length === 1 ? (width - 2 * pad) / 2 : position / (points.length - 1) * (width - 2 * pad));
  const y = (cents: number) => bottom - cents / maximum * (height - pad * 2);
  const path = points.map((point, position) => `${position ? "L" : "M"}${x(position)},${y(point.cashClosingCents)}`).join(" ");
  const barWidth = Math.min(22, (width - 2 * pad) / Math.max(1, points.length) / 2.6);
  const label = (position: number) => data.period.key === "all" ? `Mois ${getKqBusinessClock(data.businessStartedAt, Date.parse(points[position].from)).month}` : `Jour ${getKqBusinessClock(data.businessStartedAt, Date.parse(points[position].from)).dayOfMonth}`;
  return <section className={styles.card} aria-label="Évolution de la trésorerie"><header className={styles.cardHeader}><div><small className={styles.eyebrow}>Les euros qui entrent et sortent</small><h2>Évolution de la trésorerie</h2></div><div className={styles.toggle} aria-label="Données du graphique"><button type="button" aria-pressed={mode === "balance"} onClick={() => setMode("balance")}>Solde</button><button type="button" aria-pressed={mode === "flows"} onClick={() => setMode("flows")}>Entrées / sorties</button></div></header>
    <div className={styles.chartSummary} aria-live="polite"><span>{label(index)} · {shortDate(active.from)}</span><strong>{mode === "balance" ? money(active.cashClosingCents) : `${money(active.inflowsCents)} / ${money(active.outflowsCents)}`}</strong><small>{mode === "balance" ? `Solde au début : ${money(active.cashOpeningCents)}` : "Entrées / sorties de trésorerie"}</small></div>
    <div className={styles.plot}><div className={styles.axis} aria-hidden="true"><span>{money(maximum)}</span><span>{money(Math.round(maximum / 2))}</span><span>0 €</span></div><svg role="img" aria-label={`${mode === "balance" ? "Solde disponible" : "Encaissements et décaissements"}, de ${shortDate(points[0].from)} à ${shortDate(points.at(-1)!.to)}. Données détaillées dans le tableau ci-dessous.`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = (event.clientX - rect.left) / rect.width * width;
      setSelected(Math.max(0, Math.min(points.length - 1, Math.round((position - pad) / (width - 2 * pad) * (points.length - 1)))));
    }}>
      {[0, maximum / 2, maximum].map(value => <line key={value} x1={pad} x2={width - pad} y1={y(value)} y2={y(value)} className={styles.gridLine} />)}
      {mode === "balance" ? <><path d={`${path} L${x(points.length - 1)},${bottom} L${x(0)},${bottom} Z`} className={styles.chartFill} /><path d={path} className={styles.chartLine} /><circle cx={x(index)} cy={y(active.cashClosingCents)} r="4.5" className={styles.chartDot} /></> : points.map((point, position) => <g key={point.from} opacity={position === index ? 1 : .65}><rect x={x(position) - barWidth} y={y(point.inflowsCents)} width={barWidth} height={bottom - y(point.inflowsCents)} className={styles.inflowBar} /><rect x={x(position) + 1} y={y(point.outflowsCents)} width={barWidth} height={bottom - y(point.outflowsCents)} className={styles.outflowBar} /></g>)}
      <line x1={x(index)} x2={x(index)} y1={pad} y2={bottom} className={styles.cursorLine} />
    </svg></div>
    <div className={styles.plotLabels}><span>{label(0)}</span><span>{label(points.length - 1)}</span></div>
    {mode === "flows" ? <p className={styles.legend}><span><i data-kind="in" />Entrées</span><span><i data-kind="out" />Sorties</span></p> : null}
    <label className={styles.chartRange}>Explorer le graphique<input aria-label="Période du graphique" type="range" min={0} max={Math.max(0, points.length - 1)} value={index} disabled={points.length < 2} onChange={event => setSelected(Number(event.target.value))} aria-valuetext={`${label(index)}, ${shortDate(active.from)}, solde ${money(active.cashClosingCents)}, entrées ${money(active.inflowsCents)}, sorties ${money(active.outflowsCents)}`} /></label>
    <details className={styles.dataTable}><summary>Voir les données du graphique</summary><div className={styles.tableScroll}><table><caption>Flux réels de trésorerie de la période sélectionnée</caption><thead><tr><th scope="col">Période</th><th scope="col">Entrées</th><th scope="col">Sorties</th><th scope="col">Solde final</th></tr></thead><tbody>{points.map((point, position) => <tr key={point.from}><th scope="row">{label(position)}<small>{shortDate(point.from)}</small></th><td>{money(point.inflowsCents)}</td><td>{money(point.outflowsCents)}</td><td>{money(point.cashClosingCents)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

function ExpenseChart({ rows }: { rows: KqTreasuryLine[] }) {
  const nonzero = rows.filter(row => row.cents !== 0);
  const [selected, setSelected] = useState<string | null>(null);
  const maximum = Math.max(1, ...nonzero.map(row => Math.abs(row.cents)));
  const current = nonzero.find(row => row.account === selected);
  return <section className={styles.card} aria-label="Répartition des charges"><small className={styles.eyebrow}>Comprendre tes coûts</small><h2>Répartition des charges</h2><p className={styles.explanation}>Les charges de la période, y compris les factures restant à payer et l’amortissement du matériel.</p>
    {nonzero.length ? <><ul className={styles.expenseBars}>{nonzero.map(row => <li key={row.account}><button type="button" aria-pressed={selected === row.account} onClick={() => setSelected(row.account)}><span>{row.label}<strong>{money(row.cents)}</strong></span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" className={styles.expenseTrack} /><rect width={Math.abs(row.cents) / maximum * 100} height="8" className={row.cents < 0 ? styles.inflowBar : styles.outflowBar} /></svg></button></li>)}</ul><p className={styles.chartHint} aria-live="polite">{current ? `${current.label} : ${money(current.cents)}.${current.cents < 0 ? " Ce montant réduit les charges de la période." : ""}` : "Sélectionne un poste pour lire son montant. Une variation de stock négative réduit les charges."}</p></> : <p className={styles.empty}>Aucune charge sur cette période.</p>}
  </section>;
}

function AccountLines({ rows, total, totalLabel }: { rows: KqTreasuryLine[]; total: number; totalLabel: string }) {
  return <dl className={styles.accountLines}>{rows.map(row => <div key={row.account}><dt>{row.label}</dt><dd>{money(row.cents)}</dd></div>)}<div className={styles.accountTotal}><dt>{totalLabel}</dt><dd>{money(total)}</dd></div></dl>;
}
function Accounts({ report, data }: { report: Report; data: KqTreasurySnapshot }) {
  return <>
    <section className={styles.card} aria-label="Compte de résultat"><header className={styles.cardHeader}><div><small className={styles.eyebrow}>Du {shortDate(data.period.from)} au {shortDate(data.period.to)}</small><h2>Compte de résultat</h2></div><strong className={styles.resultBadge} data-negative={report.income.resultCents < 0}>{signed(report.income.resultCents)}</strong></header><p className={styles.explanation}>Le résultat compare les produits et les charges de cette période, même quand une facture sera réglée plus tard. La TVA est suivie séparément.</p><div className={styles.accountColumns}><section><h3>Produits</h3><AccountLines rows={report.income.revenues} total={report.income.revenueCents} totalLabel="Total des produits" /></section><section><h3>Charges</h3><AccountLines rows={report.income.expenses} total={report.income.expenseCents} totalLabel="Total des charges" /></section></div><div className={styles.bottomResult}><span>{report.income.resultCents < 0 ? "Perte de la période" : "Bénéfice de la période"}</span><strong>{signed(report.income.resultCents)}</strong></div></section>
    <section className={styles.card} aria-label="Bilan de gestion"><header className={styles.cardHeader}><div><small className={styles.eyebrow}>Situation au {fullDate(data.period.to)}</small><h2>Bilan de gestion</h2></div><span className={styles.balanceStatus} data-warning={report.balanceSheet.differenceCents !== 0}>{report.balanceSheet.differenceCents === 0 ? <><Check size={16} aria-hidden="true" /> Bilan équilibré</> : `Écart à vérifier : ${money(report.balanceSheet.differenceCents)}`}</span></header><div className={styles.accountColumns}><section><h3>Actif <small>Ce que possède ton entreprise</small></h3><AccountLines rows={report.balanceSheet.assets} total={report.balanceSheet.assetsCents} totalLabel="Total de l’actif" /></section><section><h3>Passif <small>Comment ton entreprise est financée</small></h3><h4>Dettes</h4><AccountLines rows={report.balanceSheet.debts} total={report.balanceSheet.debtCents} totalLabel="Total des dettes" /><h4>Capitaux propres</h4><AccountLines rows={report.balanceSheet.equity} total={report.balanceSheet.equityCents} totalLabel="Total des capitaux propres" /><div className={styles.bottomResult}><span>Total du passif</span><strong>{money(report.balanceSheet.liabilitiesCents)}</strong></div></section></div></section>
    <details className={styles.methods}><summary>Comment lire ces comptes</summary><p>La comptabilité commence le {fullDate(data.startedAt)}. La situation existante entre dans le bilan d’ouverture ; les résultats antérieurs ne sont pas reconstitués.</p><p>Le matériel est amorti sur 36 mois de jeu et le site sur 12 mois. Les abonnements et publicités payés d’avance sont répartis sur leur période d’utilisation. Les stocks sont valorisés à leurs coûts de production connus, avec une variation de stock au résultat. Le jeu ne récupère pas de TVA sur les achats : les coûts affichés restent les débits totaux.</p><p>Payer une analyse ou une facture d’électricité réduit la trésorerie et la dette : cela ne crée pas une deuxième charge. Acheter un équipement transforme de la trésorerie en matériel ; l’amortissement répartit ensuite son coût.</p><p>Un emprunt augmente la trésorerie et la dette, sans créer de chiffre d’affaires. Ses intérêts contractuels sont une charge financière. Les cryptoactifs restent au coût d’acquisition dans ce bilan de jeu ; seuls les gains et pertes réalisés à la vente entrent au résultat. Leur valeur au cours actuel est visible dans la Banque.</p>{data.unclassified && data.unclassified.transactions > 0 ? <p>{data.unclassified.transactions.toLocaleString("fr-FR")} opérations restent à classer (total des écarts : {money(data.unclassified.absoluteCents)}). Elles ne sont pas assimilées à un bénéfice.</p> : report.suspenseCents !== 0 ? <p>Des mouvements restent à classer : {money(Math.abs(report.suspenseCents))}. Ils figurent séparément au bilan et ne sont pas présentés comme un bénéfice.</p> : null}</details>
  </>;
}

function JournalEntry({ entry }: { entry: KqTreasuryEntry }) {
  const cash = entry.postings.filter(posting => posting.account === "cash").reduce((sum, posting) => sum + posting.deltaCents, 0);
  return <li><details className={styles.journalEntry}><summary><span className={styles.journalIcon}>{cash > 0 ? <ArrowDownLeft size={20} aria-hidden="true" /> : cash < 0 ? <ArrowUpRight size={20} aria-hidden="true" /> : <FileText size={19} aria-hidden="true" />}</span><span><strong>{getKqTreasuryEntryLabel(entry.kind)}</strong><small><time dateTime={entry.occurredAt}>{fullDate(entry.occurredAt)}</time></small></span><span className={styles.journalCash} data-negative={cash < 0}><strong>{cash ? signed(cash) : "Sans mouvement"}</strong><small>de trésorerie disponible</small></span></summary><div className={styles.postings}><p>Pièce : <span>{entry.reference || entry.id}</span></p><div className={styles.tableScroll}><table><caption>Écritures de cette opération</caption><thead><tr><th scope="col">Compte</th><th scope="col">Débit</th><th scope="col">Crédit</th></tr></thead><tbody>{entry.postings.map((posting, index) => <tr key={`${posting.account}-${index}`}><th scope="row">{KQ_TREASURY_ACCOUNTS[posting.account]}</th><td>{posting.deltaCents > 0 ? money(posting.deltaCents) : "—"}</td><td>{posting.deltaCents < 0 ? money(-posting.deltaCents) : "—"}</td></tr>)}</tbody></table></div></div></details></li>;
}

const ACCOUNT_GROUPS: { title: string; description: string; accounts: KqTreasuryAccount[] }[] = [
  { title: "Actif", description: "Ce que possède ton entreprise", accounts: ["cash", "vat_reserve", "savings", "crypto_assets", "equipment", "website", "stock", "prepaid"] },
  { title: "Dettes", description: "Ce qui reste à régler ou à reverser", accounts: ["lab_payable", "energy_payable", "vat_payable", "loan_payable"] },
  { title: "Capitaux propres", description: "Les ressources apportées à ton entreprise", accounts: ["opening_equity", "capital"] },
  { title: "Produits", description: "Ventes, primes et revenus financiers", accounts: KQ_TREASURY_REVENUE_ACCOUNTS },
  { title: "Charges", description: "Les coûts de ton activité", accounts: KQ_TREASURY_EXPENSE_ACCOUNTS },
  { title: "À classer", description: "Les mouvements en attente d’affectation", accounts: ["suspense"] },
];
function ChartOfAccounts({ data }: { data: KqTreasurySnapshot }) {
  const [search, setSearch] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const groups = ACCOUNT_GROUPS.map(group => ({ ...group, accounts: group.accounts.filter(account => normalize(`${group.title} ${KQ_TREASURY_ACCOUNTS[account]}`).includes(normalize(search.trim()))) })).filter(group => group.accounts.length);
  return <section className={styles.accountPlan} aria-label="Plan comptable">
    <header className={styles.cardHeader}><div><small className={styles.eyebrow}>Les comptes de ton entreprise</small><h2>Plan comptable</h2></div><label className={styles.accountSearch}><Search size={17} aria-hidden="true" /><input type="search" aria-label="Rechercher un compte" placeholder="Rechercher un compte…" value={search} onChange={event => setSearch(event.target.value)} /></label></header>
    <p className={styles.explanation}>Retrouve chaque compte utilisé dans ton bilan, ton résultat et ton journal. Les soldes correspondent à la fin de la période sélectionnée, depuis l’ouverture des comptes.</p>
    <div className={styles.accountGroups}>{groups.map(group => <section className={styles.accountGroup} key={group.title}><header><h3>{group.title}</h3><span>{group.accounts.length} compte{group.accounts.length > 1 ? "s" : ""}</span></header><p>{group.description}</p><dl>{group.accounts.map(account => { const cents = data.closingBalances[account] ?? 0; return <div key={account} data-account={account}><dt>{KQ_TREASURY_ACCOUNTS[account]}</dt><dd><strong>{money(Math.abs(cents))}</strong><small>{cents > 0 ? "Solde débiteur" : cents < 0 ? "Solde créditeur" : "Soldé"}</small></dd></div>; })}</dl></section>)}</div>
    {!groups.length ? <p className={styles.empty} role="status">Aucun compte ne correspond à cette recherche.</p> : null}
  </section>;
}

export function KqTreasuryDesk({ onOpenShop, onOpenMarket }: {
  onOpenShop: (equipmentCode?: string) => void; onOpenMarket: () => void;
}) {
  const [pole, setPole] = useState<Pole>("accounting");
  const [tab, setTab] = useState<Tab>("invoices");
  const [period, setPeriod] = useState<KqTreasuryPeriod>("current");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{ key: string; data: KqTreasurySnapshot | null; error: string }>({ key: "", data: null, error: "" });
  const key = `${period}:${offset}:${refresh}`;
  const matching = state.key === key;
  const data = matching ? state.data : null;
  const report = data ? getKqTreasuryReport(data) : null;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/arena/placard/treasury?period=${period}&offset=${offset}&limit=25`, { cache: "no-store", signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "La trésorerie est momentanément indisponible.");
        if (!isKqTreasurySnapshot(payload)) throw new Error("Les données comptables sont incomplètes. Actualise la trésorerie.");
        getKqTreasuryReport(payload);
        if (!controller.signal.aborted) { setState({ key, data: payload, error: "" }); }
      } catch (failure) {
        if (!controller.signal.aborted) setState({ key, data: null, error: failure instanceof Error ? failure.message : "Impossible de charger la trésorerie." });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, offset, period]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    const resume = () => { if (!document.hidden) update(); };
    window.addEventListener("kq:treasury-updated", update);
    document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("kq:treasury-updated", update); document.removeEventListener("visibilitychange", resume); };
  }, []);
  function selectTab(next: Tab) { setTab(next); }
  function navigatePole(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % POLES.length : event.key === "ArrowLeft" ? (index + POLES.length - 1) % POLES.length : event.key === "Home" ? 0 : event.key === "End" ? POLES.length - 1 : null;
    if (target === null) return;
    event.preventDefault(); setPole(POLES[target].id); document.getElementById(`treasury-pole-${POLES[target].id}`)?.focus();
  }
  function navigateTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    if (event.key === "ArrowRight") target = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") target = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = TABS.length - 1;
    else return;
    event.preventDefault(); setTab(TABS[target].id); document.getElementById(`treasury-tab-${TABS[target].id}`)?.focus();
  }
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.welcome}><small><Wallet size={16} aria-hidden="true" /> Trésorerie du Placard</small><h1>Le Bureau</h1><p>Les comptes au clair.<br />De la place pour faire grandir ton entreprise.</p><button type="button" className={styles.marketLink} onClick={onOpenMarket}>Aller au Marché <ArrowRight size={17} aria-hidden="true" /></button></div><div className={styles.officeArt}><Image src={OFFICE_ART[pole].src} alt={OFFICE_ART[pole].alt} fill sizes="(max-width: 650px) 100vw, 50vw" priority /><span>{OFFICE_ART[pole].caption}</span></div></header>
    <nav className={styles.poles} role="tablist" aria-label="Pôles du bureau">{POLES.map((item, index) => <button type="button" role="tab" id={`treasury-pole-${item.id}`} aria-controls={`treasury-office-${item.id}`} aria-selected={pole === item.id} tabIndex={pole === item.id ? 0 : -1} key={item.id} onClick={() => setPole(item.id)} onKeyDown={event => navigatePole(event, index)}><span className={styles.poleNumber}>{item.number}</span><item.icon size={26} aria-hidden="true" /><span className={styles.poleLabel}><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={19} className={styles.poleArrow} aria-hidden="true" /></button>)}</nav>
    <section id={`treasury-office-${pole}`} role="tabpanel" aria-labelledby={`treasury-pole-${pole}`} className={styles.officePanel} tabIndex={0}>
    {pole === "bank" ? <KqTreasuryBank /> : pole === "management" ? <><div className={styles.managementIntro}><small className={styles.eyebrow}>03 / Gestion</small><h2>Pilote ton entreprise</h2><p>Ton site internet, tes campagnes publicitaires et l’adresse de ton commerce.</p></div><KqTreasuryManagement key="management" onOpenShop={onOpenShop} section="management" /><button type="button" className={styles.inlineLink} onClick={() => { setPole("accounting"); selectTab("invoices"); }}>Retrouver mes factures en comptabilité <ArrowRight size={16} aria-hidden="true" /></button></> : <>
    <div className={styles.managementIntro}><small className={styles.eyebrow}>01 / Comptabilité</small><h2>Chaque chose à sa place</h2><p>Règle tes factures, suis tes résultats et retrouve le détail de tes comptes.</p></div>
    <nav className={styles.tabs} role="tablist" aria-label="Dossiers de comptabilité">{TABS.map((item, index) => <button type="button" role="tab" id={`treasury-tab-${item.id}`} aria-controls={`treasury-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} key={item.id} onClick={() => selectTab(item.id)} onKeyDown={event => navigateTab(event, index)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></button>)}</nav>
    <section id={`treasury-panel-${tab}`} role="tabpanel" aria-labelledby={`treasury-tab-${tab}`} className={styles.tabPanel} tabIndex={0}>
      {tab === "invoices" ? <KqTreasuryManagement key="invoices" onOpenShop={onOpenShop} section="invoices" /> : <>
        <div className={styles.toolbar}><label>Période comptable<select value={period} onChange={event => { setPeriod(event.target.value as KqTreasuryPeriod); setOffset(0); }}>{(Object.keys(KQ_TREASURY_PERIODS) as KqTreasuryPeriod[]).map(value => <option key={value} value={value}>{KQ_TREASURY_PERIODS[value]}</option>)}</select></label><button type="button" className={styles.refresh} disabled={!matching} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" /> Actualiser</button>{data ? <TreasuryClock key={data.serverNow} startedAt={data.businessStartedAt} serverNow={data.serverNow} /> : null}</div>
        {!matching ? <p className={styles.loading} role="status"><LoaderCircle size={22} className={styles.spin} aria-hidden="true" /> Lecture de tes comptes…</p> : state.error ? <div className={styles.error} role="alert"><strong>Les comptes n’ont pas pu être chargés.</strong><p>{state.error}</p><button type="button" className={styles.primary} onClick={() => setRefresh(value => value + 1)}>Réessayer</button></div> : data && report ? <>
          <p className={styles.periodNote}>{period === "previous" ? "Situation historique" : "Situation actualisée"} au {fullDate(data.period.to)} · Comptes ouverts le {shortDate(data.startedAt)}.</p>
          {period === "previous" && data.period.from === data.period.to ? <p className={styles.periodNote}>Le suivi comptable a commencé après cette période. Seule la situation d’ouverture est disponible.</p> : null}
          {report.reconciled === false ? <p className={styles.reconciliation} role="status">Les comptes présentent un écart avec les soldes du jeu. Actualise pour vérifier la situation.</p> : null}
          {tab === "overview" ? <>
            <div className={styles.metrics}><article><small>Trésorerie disponible{period === "previous" ? " à cette date" : ""}</small><strong>{money(report.cash.availableCents)}</strong><span>{signed(report.cash.changeCents)} sur la période</span></article><article><small>Ventes hors TVA</small><strong>{money(report.income.salesHtCents)}</strong><span>Chiffre d’affaires de la période</span></article><article data-negative={report.income.resultCents < 0}><small>Résultat de la période</small><strong>{signed(report.income.resultCents)}</strong><span>{report.income.resultCents < 0 ? "Perte après charges" : "Bénéfice après charges"}</span></article><article><small>Factures restant à payer</small><strong>{money(report.cash.unpaidCents)}</strong><span>Analyses, électricité et soins</span></article></div>
            <div className={styles.cashStrip}><span>TVA réservée <strong>{money(report.cash.reservedVatCents)}</strong></span><span>Épargne <strong>{money(report.cash.savingsCents)}</strong></span><span>Cryptoactifs · coût d’acquisition <strong>{money(report.cash.cryptoCostCents)}</strong></span><span>Emprunts restant dus <strong>{money(report.cash.loanDebtCents)}</strong></span><span>Disponible après règlement des factures <strong data-negative={report.cash.afterDebtCents < 0}>{money(report.cash.afterDebtCents)}</strong></span></div>
            <div className={styles.chartColumns}><CashChart key={`cash:${period}:${data.period.from}`} data={data} /><ExpenseChart key={`expenses:${period}:${data.period.from}`} rows={report.income.expenses} /></div>
            <section className={styles.managementCallout}><ReceiptText size={26} aria-hidden="true" /><div><h2>Tes prochaines échéances</h2><p>Consulte les factures en cours et les montants restant à régler.</p></div><button type="button" className={styles.primary} onClick={() => selectTab("invoices")}>Voir mes factures <ArrowRight size={18} aria-hidden="true" /></button></section>
          </> : tab === "accounts" ? <Accounts data={data} report={report} /> : tab === "chartOfAccounts" ? <ChartOfAccounts data={data} /> : <section className={styles.card} aria-label="Journal comptable"><header className={styles.cardHeader}><div><small className={styles.eyebrow}>Chaque opération, sa trace</small><h2>Journal des opérations</h2></div><span className={styles.journalCount}>{data.journal.total.toLocaleString("fr-FR")} écriture{data.journal.total > 1 ? "s" : ""}</span></header><p className={styles.explanation}>Ouvre une opération pour voir les comptes débités et crédités. Le montant affiché correspond à son effet sur la trésorerie disponible.</p>{data.journal.items.length ? <ul className={styles.journal}>{data.journal.items.map(entry => <JournalEntry key={entry.id} entry={entry} />)}</ul> : <p className={styles.empty}>Aucune écriture sur cette période.</p>}<nav className={styles.pagination} aria-label="Pages du journal"><button type="button" disabled={data.journal.offset === 0} onClick={() => setOffset(Math.max(0, data.journal.offset - data.journal.limit))}><ChevronLeft size={18} aria-hidden="true" /> Précédent</button><span>{data.journal.total ? `${data.journal.offset + 1}–${Math.min(data.journal.offset + data.journal.items.length, data.journal.total)} sur ${data.journal.total}` : "0 écriture"}</span><button type="button" disabled={data.journal.offset + data.journal.limit >= data.journal.total} onClick={() => setOffset(data.journal.offset + data.journal.limit)}>Suivant <ChevronRight size={18} aria-hidden="true" /></button></nav><button type="button" className={styles.inlineLink} onClick={() => selectTab("invoices")}>Consulter les prochaines échéances <ArrowRight size={16} aria-hidden="true" /></button></section>}
        </> : null}
      </>}
    </section>
    </>}
    </section>
  </main>;
}
