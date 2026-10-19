"use client";

import { useState } from "react";
import { getKqBankLimitCents, KQ_BANK_TIERS } from "@/lib/kanab-quest-bank";
import styles from "./KqBankVisuals.module.css";

const money = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export function KqBankCreditChart({ reputation, maxCents }: { reputation: number; maxCents: number }) {
  const next = KQ_BANK_TIERS.find(tier => tier.reputation > reputation);
  const lower = [...KQ_BANK_TIERS].reverse().find(tier => tier.reputation <= reputation) ?? KQ_BANK_TIERS[0];
  const target = next ?? KQ_BANK_TIERS[KQ_BANK_TIERS.length - 1];
  const origin = next ? lower : KQ_BANK_TIERS[0];
  const ceiling = Math.max(target.maxCents, maxCents);
  const x = (rep: number) => 12 + Math.min(1, Math.max(0, (rep - origin.reputation) / (target.reputation - origin.reputation || 1))) * 336;
  const y = (cents: number) => 146 - cents / ceiling * 128;
  const actualX = x(reputation), actualY = y(maxCents);
  const progressive = maxCents === getKqBankLimitCents(reputation);
  const previous = KQ_BANK_TIERS.filter(tier => tier.reputation >= origin.reputation && tier.reputation < reputation);
  const earned = [
    `M ${x(origin.reputation)} ${y(origin.maxCents)}`,
    ...previous.map(tier => `L ${x(tier.reputation)} ${y(tier.maxCents)}`),
    `L ${actualX} ${actualY}`,
  ].join(" ");
  const ahead = progressive ? `M ${actualX} ${actualY} L ${x(target.reputation)} ${y(target.maxCents)}`
    : `M ${actualX} ${actualY} H ${x(target.reputation)} V ${y(target.maxCents)}`;
  return <figure className={styles.credit} aria-label="Capacité d’emprunt selon la réputation" data-bank-credit-chart>
    <figcaption><span>Réputation → crédit</span><strong>{reputation.toLocaleString("fr-FR")} points</strong></figcaption>
    <svg viewBox="0 0 360 160" aria-hidden="true">
      {[0, .5, 1].map(fraction => <line key={fraction} x1="12" x2="348" y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} className={styles.grid} />)}
      <path d={`${earned} L ${actualX} 146 L 12 146 Z`} className={styles.area} />
      <path d={earned} className={styles.line} />
      {next ? <path d={ahead} className={styles.future} /> : null}
      <line x1={actualX} x2={actualX} y1={actualY} y2="146" className={styles.cursor} />
      <circle cx={x(target.reputation)} cy={y(target.maxCents)} r="5" className={styles.target} />
      <circle cx={actualX} cy={actualY} r="7" className={styles.dot} />
    </svg>
    <div className={styles.axes}><span>{origin.reputation.toLocaleString("fr-FR")} pts<br />{money(origin.maxCents)}</span><span>{target.reputation.toLocaleString("fr-FR")} pts<br />{money(target.maxCents)}</span></div>
    <div className={styles.next}><span>{next ? `Encore ${(next.reputation - reputation).toLocaleString("fr-FR")} points` : "Plafond maximal atteint"}</span><strong>{next ? `→ ${money(next.maxCents)}` : money(maxCents)}</strong></div>
    <span className={styles.srOnly}>Plafond autorisé aujourd’hui : {money(maxCents)}. {next ? `Prochain repère : ${next.reputation} points, pour ${money(next.maxCents)}.` : "Dernier repère atteint."}</span>
  </figure>;
}

type Installment = { amountCents: number; paidCents?: number; at?: string };
export function KqBankRepaymentChart({ installments, serverNow }: { installments: Installment[]; serverNow?: string }) {
  const [selected, setSelected] = useState(0);
  const active = installments[Math.min(selected, installments.length - 1)];
  if (!active) return null;
  const maximum = Math.max(1, ...installments.map(item => item.amountCents));
  const label = (item: Installment, index: number) => item.at
    ? new Date(item.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : `J + ${(index + 1) * 30}`;
  const status = (item: Installment) => item.paidCents === item.amountCents ? "Réglée"
    : item.at && serverNow && Date.parse(item.at) <= Date.parse(serverNow) ? "En retard"
      : (item.paidCents ?? 0) > 0 ? "En partie réglée" : "À venir";
  return <figure className={styles.repayments} aria-label="Échéancier du prêt" data-bank-schedule>
    <figcaption><strong>7 échéances</strong><span>Tous les 30 jours de jeu · 5 jours réels</span></figcaption>
    <ol>{installments.map((item, index) => <li key={index}><button type="button" aria-pressed={selected === index}
      aria-label={`Échéance ${index + 1}, ${label(item, index)}, ${money(item.amountCents)}, ${status(item)}`}
      onClick={() => setSelected(index)} data-overdue={status(item) === "En retard" || undefined}>
      <span className={styles.column} aria-hidden="true"><i style={{ height: `${item.amountCents / maximum * 100}%` }}><b style={{ height: `${Math.min(item.amountCents, item.paidCents ?? 0) / Math.max(1, item.amountCents) * 100}%` }} /></i></span>
      <span className={styles.columnLabel}>{index + 1}</span>
    </button></li>)}</ol>
    <div className={styles.selected} aria-live="polite"><span>{label(active, selected)}<small>{status(active)}</small></span><strong>{money(active.amountCents)}{(active.paidCents ?? 0) > 0 ? <small>{money(active.paidCents!)} réglés</small> : null}</strong></div>
  </figure>;
}
