"use client";

import { useState } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqInvestmentPayback } from "@/lib/kanab-quest-investment";
import styles from "./KqInvestmentPayback.module.css";

export function KqInvestmentPayback({ investmentCents, extraCostCents = 0, unit }: {
  investmentCents: number;
  extraCostCents?: number;
  unit: "cycle" | "lot";
}) {
  const [input, setInput] = useState("");
  const amount = /^-?\d{1,8}(?:[.,]\d{1,2})?$/.test(input.trim()) ? Math.round(Number(input.replace(",", ".")) * 100) : null;
  const margin = amount === null ? null : amount - extraCostCents;
  const payback = margin === null ? null : getKqInvestmentPayback(investmentCents, margin);
  return <div className={styles.scenario} data-investment-payback>
    <label>{unit === "cycle" ? "Écart de recette nette par cycle (€)" : "Gain net en plus par lot (€)"}
      <input inputMode="decimal" value={input} onChange={event => setInput(event.target.value)} aria-invalid={input !== "" && amount === null || undefined} />
    </label>
    <small>{unit === "cycle" ? "Après TVA et frais de vente. Saisis 0 pour comparer la même vente." : "Saisis la marge supplémentaire que tu attends en tenant compte des frais et du travail payé."}</small>
    <p aria-live="polite">{margin === null ? (input === "" ? "Amortissement à calculer." : "Saisis un montant en euros avec deux décimales au maximum.") : <>
      {unit === "cycle" && <>Écart de marge · <strong data-investment-margin-cents={margin}>{formatKqCash(margin)}</strong> par cycle. </>}
      {payback === null ? "L’achat ne s’amortit pas avec cette hypothèse." : <>Amortissement · <strong data-investment-payback-count={payback}>{payback} {unit}{payback !== 1 ? "s" : ""}</strong> si ce gain se répète.</>}
    </>}</p>
  </div>;
}
