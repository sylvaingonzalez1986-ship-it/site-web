import { formatKqCash } from "./kanab-quest-equipment";
import type { KqHubAttentionResult } from "./kanab-quest-hub-attention";

const UPCOMING_MS = 24 * 60 * 60 * 1_000;
type Category = "lab" | "suppliers";
type Invoice = { id: string; category: Category; remainingCents: number; dueAt: string; dueMs: number };
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown) => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;

/** Each category is independent: an unreadable supplier summary cannot erase known laboratory debt. */
function readCategory(value: unknown, category: Category, now: number): Invoice[] | null {
  const data = record(value);
  if (!data || !cents(data.outstandingCents) || !cents(data.overdueCents) || data.overdueCents > data.outstandingCents || !Array.isArray(data.invoices)) return null;
  const invoices: Invoice[] = [];
  const ids = new Set<string>();
  let outstanding = 0, overdue = 0;
  for (const value of data.invoices) {
    const row = record(value);
    if (!row || typeof row.id !== "string" || !row.id.trim() || ids.has(row.id) || !cents(row.remainingCents)) return null;
    ids.add(row.id);
    if (row.remainingCents === 0) continue;
    const dueMs = timestamp(row.dueAt);
    if (!Number.isFinite(dueMs)) return null;
    outstanding += row.remainingCents;
    if (dueMs <= now) overdue += row.remainingCents;
    if (!Number.isSafeInteger(outstanding) || !Number.isSafeInteger(overdue)) return null;
    invoices.push({ id: row.id, category, remainingCents: row.remainingCents, dueAt: row.dueAt as string, dueMs });
  }
  // These two API lists contain every unpaid invoice. A mismatch means the read is partial or inconsistent.
  return outstanding === data.outstandingCents && overdue === data.overdueCents ? invoices : null;
}

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
}).format(new Date(value));

/** Advice based on dated lab/supplier invoices only; no payment, cash projection or client-clock inference. */
export function getKqHubFinanceAttention(payload: unknown): KqHubAttentionResult {
  const business = record(record(payload)?.business);
  const now = timestamp(business?.serverNow);
  if (!business || !Number.isFinite(now)) return { notice: null, complete: false };
  const lab = readCategory(business.lab, "lab", now);
  const suppliers = readCategory(business.suppliers, "suppliers", now);
  const complete = lab !== null && suppliers !== null;
  const invoices = [...(lab ?? []), ...(suppliers ?? [])].sort((left, right) => left.dueMs - right.dueMs || left.category.localeCompare(right.category) || left.id.localeCompare(right.id));
  const invoice = invoices.find(row => row.dueMs <= now) ?? invoices.find(row => row.dueMs <= now + UPCOMING_MS);
  if (!invoice) return { notice: null, complete };
  const overdue = invoice.dueMs <= now;
  const category = invoice.category === "lab" ? "laboratoire" : "fournisseur";
  const label = invoice.category === "lab" ? "Laboratoire" : "Fournisseur";
  const amount = formatKqCash(invoice.remainingCents);
  const due = date(invoice.dueAt);
  return {
    complete,
    notice: {
      id: overdue ? "invoice-overdue" : "invoice-upcoming",
      severity: overdue ? "urgent" : "upcoming",
      title: overdue ? "Une facture est échue" : "Une facture arrive à échéance",
      description: `${label} : ${amount} restent à régler sur cette facture. Échéance ${overdue ? "atteinte" : "prévue"} le ${due} (heure de Paris).`,
      buttonLabel: "Voir mes factures",
      summary: overdue ? `Facture ${category} : ${amount} échus.` : `Facture ${category} : ${amount} le ${due} (Paris).`,
      destination: "treasury",
      options: { treasuryPole: "accounting" },
    },
  };
}
