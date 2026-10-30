import { describe, expect, it } from "vitest";
import { getKqPlacardResume, type KqPlacardResumeAttention, type KqPlacardResumeStorage } from "./kanab-quest-hub";
import type { KqHubAttentionNotice } from "./kanab-quest-hub-attention";

const idle = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0, curingFlowerCount: 0 };
const emptyStorage: KqPlacardResumeStorage = { serverNow: "2026-10-29T12:00:00Z", lots: [] };
const invoice: KqHubAttentionNotice = { id: "invoice-overdue", severity: "urgent", title: "Facture fournisseur échue", description: "75,80 € restent à régler.", summary: "Facture fournisseur : 75,80 € échus.", buttonLabel: "Voir mes factures", destination: "treasury", options: { treasuryPole: "accounting" } };
const sale: KqHubAttentionNotice = { id: "sales-quality", severity: "attention", title: "Vente bloquée", description: "La qualité du lot est insuffisante.", summary: "Orange sanguine : vente bloquée.", buttonLabel: "Vérifier cette annonce", destination: "market", options: { marketSection: "dashboard", listingId: "listing-exact" } };
const upcoming: KqHubAttentionNotice = { ...invoice, id: "invoice-upcoming", severity: "upcoming", title: "Facture à prévoir", summary: "Facture fournisseur : demain, 75,80 €." };
const attention = (finance: KqHubAttentionNotice | null = null, sales: KqHubAttentionNotice | null = null): KqPlacardResumeAttention => ({ finance: { notice: finance, complete: true }, sales: { notice: sales, complete: true }, loading: false });

describe("Quartier attention preserves priorities and exact destinations", () => {
  it("keeps exposed stock first, with two actionable notices and no extra feed", () => {
    const storage: KqPlacardResumeStorage = { ...emptyStorage, lots: [{ flowerStatus: "available", projection: { stage: "curing", readyAt: "2026-10-29T18:00:00Z", capacity: { overflowUnits: 100, overflowDeadlineAt: null } } }] };
    const result = getKqPlacardResume({ ...idle, activeRun: true }, storage, attention(invoice, sale));
    expect(result.kind).toBe("storage");
    expect(result.facts).toEqual([invoice.summary, sale.summary]);
    expect(result.factActions.map(notice => notice.options)).toEqual([{ treasuryPole: "accounting" }, { marketSection: "dashboard", listingId: "listing-exact" }]);
  });

  it("shows a due invoice before blocked sales and keeps the saved culture discoverable", () => {
    const result = getKqPlacardResume({ ...idle, activeRun: true }, emptyStorage, attention(invoice, sale));
    expect(result).toMatchObject({ kind: "finance", tone: "attention", primary: { destination: "treasury", options: { treasuryPole: "accounting" } } });
    expect(result.facts).toEqual([sale.summary, expect.stringContaining("culture est sauvegardée")]);
  });

  it.each([{ ...idle, activeRun: true }, { ...idle, readyLotCount: 1 }, { ...idle, availableFlowerCount: 1 }])("keeps a future invoice secondary to an activity already playable: %o", snapshot => {
    const result = getKqPlacardResume(snapshot, emptyStorage, attention(upcoming));
    expect(["culture", "market", "jury"]).toContain(result.kind);
    expect(result.facts).toContain(upcoming.summary);
    expect(result.factActions).toEqual([upcoming]);
  });

  it("offers a future invoice during safe waiting without describing it as overdue", () => {
    const storage: KqPlacardResumeStorage = { ...emptyStorage, lots: [{ flowerStatus: "available", projection: { stage: "curing", readyAt: "2026-10-29T18:00:00Z", capacity: { overflowUnits: 0, overflowDeadlineAt: null } } }] };
    const result = getKqPlacardResume({ ...idle, curingFlowerCount: 1 }, storage, attention(upcoming));
    expect(result).toMatchObject({ kind: "finance", tone: "ready", primary: { eyebrow: "Échéance à préparer" } });
    expect(result.facts[0]).toContain("Affinage automatique");
    delete storage.lots[0].projection.capacity;
    expect(getKqPlacardResume({ ...idle, curingFlowerCount: 1 }, storage, attention(upcoming)).kind).toBe("curing");
  });

  it("keeps the exact blocked listing and reports an unreadable finance source independently", () => {
    const result = getKqPlacardResume(idle, emptyStorage, { ...attention(null, sale), finance: null });
    expect(result).toMatchObject({ kind: "sales", primary: { options: { marketSection: "dashboard", listingId: "listing-exact" } }, canRefreshAttention: true });
    expect(result.facts).toContain("Le suivi des factures reste partiel.");
  });

  it("never blocks the gameplay action while financial and sales evidence is loading or unavailable", () => {
    const active = { ...idle, activeRun: true };
    const value: KqPlacardResumeAttention = { finance: null, sales: null, loading: true };
    expect(getKqPlacardResume(active, emptyStorage, value)).toMatchObject({ kind: "culture", canRefreshAttention: false, facts: ["Factures et ventes en cours de vérification."] });
    expect(getKqPlacardResume(active, emptyStorage, { ...value, loading: false })).toMatchObject({ kind: "culture", canRefreshAttention: true, facts: ["Le suivi des factures et des ventes reste à vérifier."] });
  });

  it("returns to the ordinary loop after the server confirms that the attention item is gone", () => {
    const known = attention(invoice);
    const original = structuredClone(known);
    expect(getKqPlacardResume(idle, emptyStorage, known).kind).toBe("finance");
    expect(known).toEqual(original);
    const result = getKqPlacardResume(idle, emptyStorage, attention());
    expect(result).toMatchObject({ kind: "new-culture", facts: [], factActions: [], attentionStatus: null, canRefreshAttention: false });
  });

  it("keeps a failed-read recovery visible even when two other activities are ready", () => {
    const result = getKqPlacardResume({ ...idle, activeRun: true, readyLotCount: 2, availableFlowerCount: 1 }, emptyStorage, { finance: null, sales: null, loading: false });
    expect(result.kind).toBe("culture");
    expect(result.facts).toHaveLength(2);
    expect(result.facts).toContain("Le suivi des factures et des ventes reste à vérifier.");
    expect(result.canRefreshAttention).toBe(true);
  });
});
