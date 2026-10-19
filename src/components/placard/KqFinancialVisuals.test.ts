import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KqBankCreditChart, KqBankRepaymentChart } from "./KqBankVisuals";
import { KqPortfolioBreakdown } from "./KqPortfolioBreakdown";
import { KqBarChart } from "./KqVisuals";

describe("financial visuals preserve the meaning of server data", () => {
  it("shows the offered limit even when the bank still uses the old policy", () => {
    const html = renderToStaticMarkup(createElement(KqBankCreditChart, { reputation: 475, maxCents: 500_000 }));
    expect(html).toContain(`Plafond autorisé aujourd’hui : ${(5000).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`);
    expect(html).not.toContain((18750).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }));
    expect(html).toContain("Encore 125 points");
  });
  it("shows the progressive limit and next target separately", () => {
    const html = renderToStaticMarkup(createElement(KqBankCreditChart, { reputation: 475, maxCents: 1_875_000 }));
    expect(html).toContain(`Plafond autorisé aujourd’hui : ${(18750).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`);
    expect(html).toContain("Prochain repère : 600 points");
  });
  it("does not turn a missing quotation into a zero-valued portfolio", () => {
    const html = renderToStaticMarkup(createElement(KqPortfolioBreakdown, { positions: [
      { label: "Position en attente", costBasisCents: 100_000, valueCents: null },
      { label: "Position cotée", costBasisCents: 50_000, valueCents: 60_000 },
    ] }));
    expect(html).toContain("Valeur actuelle indisponible");
    expect(html).toContain("Position en attente");
    expect(html).not.toContain("Investissement et valeur actuelle");
  });
  it("keeps an actual zero valuation visible", () => {
    const html = renderToStaticMarkup(createElement(KqPortfolioBreakdown, { positions: [{ label: "Position", costBasisCents: 100_000, valueCents: 0 }] }));
    expect(html).toContain("Investissement et valeur actuelle");
    expect(html).not.toContain("indisponible");
  });
  it("keeps negative balances signed on their own side of zero", () => {
    const html = renderToStaticMarkup(createElement(KqBarChart, { title: "Disponible", items: [
      { label: "Après factures", value: -100, displayValue: "−1 €" }, { label: "Épargne", value: 200, displayValue: "2 €" },
    ] }));
    expect(html).toContain("−1 €");
    expect(html).toContain('data-negative="true"');
    expect(html).toContain('data-signed="true"');
  });
  it("distinguishes paid, overdue, and future installments in accessible controls", () => {
    const html = renderToStaticMarkup(createElement(KqBankRepaymentChart, { serverNow: "2026-10-18T12:00:00Z", installments: [
      { amountCents: 10000, paidCents: 10000, at: "2026-10-08T12:00:00Z" },
      { amountCents: 10000, paidCents: 2500, at: "2026-10-13T12:00:00Z" },
      { amountCents: 10000, paidCents: 0, at: "2026-10-23T12:00:00Z" },
    ] }));
    expect(html).toMatch(/aria-label="Échéance 1,[^"]*Réglée"/);
    expect(html).toMatch(/aria-label="Échéance 2,[^"]*En retard"/);
    expect(html).toMatch(/aria-label="Échéance 3,[^"]*À venir"/);
  });
});
