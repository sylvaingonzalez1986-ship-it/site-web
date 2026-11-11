"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseSupportEuros, supportEuros, type AdminSupportDashboard, type AdminSupportRow } from "@/lib/support-campaign";
import { supportRequest } from "@/lib/support-client";

const button = "btn-cartoon btn-secondary text-sm";
const input = "min-h-11 w-full min-w-0 rounded border-2 border-ink bg-white p-2 text-ink";

function SupportRow({ row, busy, mutate }: { row: AdminSupportRow; busy: boolean; mutate: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [fee, setFee] = useState(row.feesCents === null ? "" : String(row.feesCents / 100));
  const [reference, setReference] = useState(row.feeReference ?? "");
  const [transaction, setTransaction] = useState(row.transactionId ?? "");
  const [error, setError] = useState("");
  async function saveFees(event: FormEvent) {
    event.preventDefault(); setError("");
    const cents = parseSupportEuros(fee);
    if (cents === null || cents > 1_000_000 || !reference.trim()) { setError("Saisis les frais réels et la référence du relevé."); return; }
    await mutate({ action: "fees", id: row.id, feesCents: cents, reference });
  }
  return <details className="min-w-0 border-b border-ink/30 py-4">
    <summary className="cursor-pointer break-words font-semibold">
      {row.pseudonym} · {supportEuros(row.amountCents)} · {row.reviewRequired ? "À rapprocher" : row.paidAt ? row.refundedCents >= row.capturedCents ? "Remboursé" : "Confirmé" : row.checkoutState === "cancelled" ? "Session annulée" : "En attente"}
      <span className="ml-2 text-xs font-normal">{new Date(row.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span>
    </summary>
    <div className="mt-3 grid min-w-0 gap-4 text-sm">
      <dl className="grid grid-cols-1 gap-2 break-all sm:grid-cols-2">
        <div><dt className="font-semibold">Référence soutien</dt><dd>{row.id}</dd></div>
        <div><dt className="font-semibold">Source Viva</dt><dd>{row.sourceCode}</dd></div>
        <div><dt className="font-semibold">Commande Viva</dt><dd>{row.orderCode ?? "Non rattachée"}</dd></div>
        <div><dt className="font-semibold">Transaction encaissée</dt><dd>{row.transactionId ?? "Non confirmée"}</dd></div>
        <div><dt className="font-semibold">Confirmé le</dt><dd>{row.paidAt ? new Date(row.paidAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "En attente"}</dd></div>
        <div><dt className="font-semibold">Remboursements vérifiés</dt><dd>{supportEuros(row.refundedCents)}</dd></div>
      </dl>
      <p>Affichage public : {row.hidden || !row.publishName ? "Anonyme" : row.pseudonym} · {row.hidden || !row.publishAmount ? "montant masqué" : "montant visible"}.</p>
      <div><button type="button" className={button} disabled={busy} onClick={() => void mutate({ action: "visibility", id: row.id, hidden: !row.hidden })}>{row.hidden ? "Rétablir les préférences du donateur" : "Masquer le pseudo et le montant"}</button></div>
      {row.paidAt && <form onSubmit={saveFees} className="grid items-end gap-3 sm:grid-cols-3">
        <label>Frais réels Viva en euros<input className={input} inputMode="decimal" value={fee} onChange={event => setFee(event.target.value)} required disabled={busy} /></label>
        <label>Référence du relevé<input className={input} value={reference} maxLength={200} onChange={event => setReference(event.target.value)} required disabled={busy} /></label>
        <button className={button} disabled={busy}>Enregistrer les frais</button>
        <p className="sm:col-span-3">{row.feesCents === null ? "Frais inconnus : le net n’est pas calculé." : `Frais rapprochés : ${supportEuros(row.feesCents)}. Chaque correction est conservée dans le journal administratif.`}</p>
      </form>}
      <form onSubmit={event => { event.preventDefault(); void mutate({ action: "reconcile", id: row.id, transactionId: transaction.trim() }); }} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <label>Transaction Viva à vérifier (paiement ou remboursement)<input className={input} value={transaction} onChange={event => setTransaction(event.target.value)} required disabled={busy} /></label>
        <button className={button} disabled={busy}>Vérifier auprès de Viva</button>
      </form>
      {error && <p role="alert" className="font-semibold text-red-800">{error}</p>}
    </div>
  </details>;
}

export function AdminSupportPanel() {
  const [dashboard, setDashboard] = useState<AdminSupportDashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [active, setActive] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const generation = useRef(0);
  const lock = useRef(false);
  const query = new URLSearchParams({ from, to, page: String(page) }).toString();
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true); setError("");
    try {
      const data = await supportRequest<AdminSupportDashboard>(`/api/admin/support?${query}`);
      if (ticket !== generation.current) return;
      setDashboard(data); setGoal(data.campaign.goalCents === null ? "" : String(data.campaign.goalCents / 100)); setActive(data.campaign.active);
    } catch (cause) { if (ticket === generation.current) setError((cause as Error).message); }
    finally { if (ticket === generation.current) setLoading(false); }
  }, [query]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  async function mutate(body: Record<string, unknown>) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await supportRequest("/api/admin/support", body); setNotice("Enregistrement confirmé."); await load(); return true; }
    catch (cause) { setError((cause as Error).message); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveCampaign(event: FormEvent) {
    event.preventDefault();
    const cents = goal.trim() ? parseSupportEuros(goal) : null;
    if (goal.trim() && (cents === null || cents <= 0 || cents > 1_000_000_000)) { setError("Saisis un objectif positif ou laisse le champ vide."); return; }
    await mutate({ action: "campaign", active, goalCents: cents });
  }
  const totals = dashboard?.totals;
  const disabled = busy || loading;
  return <section className="cartoon-border min-w-0 bg-cream p-4 sm:p-6" aria-busy={disabled}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-3xl">Soutiens aux producteurs</h2><p className="mt-2 text-sm">Cagnotte, versements et rapprochement Viva. Les ventes restent dans leur propre registre.</p></div><button className={button} disabled={disabled} onClick={() => void load()}>Recharger</button></div>
    {error && <p role="alert" className="mt-4 rounded border-2 border-ink bg-[#fff0e5] p-3">{error}</p>}
    {notice && <p role="status" className="mt-4 font-semibold">{notice}</p>}
    {loading && !dashboard && <p role="status" className="mt-4">Chargement des soutiens…</p>}
    {dashboard && <div className="mt-5 grid gap-6">
      <form className="card-cartoon grid gap-4 bg-white p-4" onSubmit={saveCampaign}>
        <h3 className="font-display text-2xl">La cagnotte</h3>
        {!dashboard.configured && <p className="font-semibold text-red-800">{dashboard.configurationError}</p>}
        <label className="max-w-sm">Objectif en euros (facultatif)<input className={input} value={goal} inputMode="decimal" onChange={event => setGoal(event.target.value)} disabled={disabled} /><small>Sans objectif, le cumul reste visible sans jauge ni pourcentage.</small></label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} disabled={disabled || !dashboard.configured} />Accepter de nouveaux soutiens</label>
        <p className="text-sm">Une fermeture conserve les paiements déjà engagés et leur suivi. Les soutiens sont sans contrepartie et reçus par la SASU Les Champs Bretons.</p>
        <div className="flex flex-wrap gap-3"><button className="btn-cartoon btn-primary" disabled={disabled}>Enregistrer la cagnotte</button><a className={button} href="/soutenir" target="_blank" rel="noopener noreferrer">Voir la page publique</a></div>
      </form>
      <div className="flex flex-wrap items-end gap-3">
        <label>Créés à partir du<input className={input} type="date" value={from} onChange={event => { setPage(0); setFrom(event.target.value); }} disabled={busy} /></label>
        <label>Jusqu’au<input className={input} type="date" value={to} onChange={event => { setPage(0); setTo(event.target.value); }} disabled={busy} /></label>
        <a className={button} href={`/api/admin/support?${query}&format=csv`} download>Exporter les soutiens CSV</a>
        <small className="basis-full">Période de création des soutiens, heure de Paris. Les remboursements et frais affichés sont leur cumul connu à ce jour.</small>
      </div>
      {totals && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Encaissé', supportEuros(totals.capturedCents)], ['Remboursé', supportEuros(totals.refundedCents)], ['Frais connus', supportEuros(totals.feesCents)], ['Net après frais', totals.missingFees || totals.reviewCount ? 'À compléter' : supportEuros(totals.capturedCents - totals.refundedCents - totals.feesCents)]].map(([label, value]) => <div key={label} className="card-cartoon min-w-0 break-words bg-white p-3"><p className="text-sm">{label}</p><strong className="text-xl">{value}</strong></div>)}
      </div>}
      {Boolean(totals?.missingFees || totals?.reviewCount) && <p>{totals?.missingFees} soutien(s) avec frais à renseigner · {totals?.reviewCount} versement(s) à rapprocher. Les montants inconnus ne sont pas comptés comme des frais nuls.</p>}
      <div><h3 className="font-display text-2xl">Registre des soutiens</h3><p className="my-2 text-sm">{dashboard.total} fiche(s) dans la période. Une fiche en attente n’est pas un versement encaissé.</p>
        {dashboard.rows.map(row => <SupportRow key={`${row.id}:${row.feeUpdatedAt}:${row.hidden}`} row={row} busy={disabled} mutate={mutate} />)}
        {!dashboard.rows.length && <p>Aucun soutien dans cette période.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3"><button className={button} disabled={disabled || page === 0} onClick={() => setPage(value => value - 1)}>Précédents</button><span>Page {page + 1}</span><button className={button} disabled={disabled || (page + 1) * 50 >= dashboard.total} onClick={() => setPage(value => value + 1)}>Suivants</button></div>
      </div>
    </div>}
  </section>;
}
