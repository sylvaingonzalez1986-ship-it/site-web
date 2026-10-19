import { KqAllocationBar, KqBarChart } from "./KqVisuals";
import styles from "./KqPortfolioBreakdown.module.css";

const money = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export function KqPortfolioBreakdown({ positions }: { positions: { label: string; costBasisCents: number; valueCents: number | null }[] }) {
  if (!positions.length) return null;
  const sorted = [...positions].sort((a, b) => b.costBasisCents - a.costBasisCents);
  const main = sorted.slice(0, 5).map(position => ({ label: position.label, value: position.costBasisCents, displayValue: money(position.costBasisCents) }));
  if (sorted.length > 5) {
    const rest = sorted.slice(5).reduce((sum, position) => sum + position.costBasisCents, 0);
    main.push({ label: "Autres positions", value: rest, displayValue: money(rest) });
  }
  const invested = positions.reduce((sum, position) => sum + position.costBasisCents, 0);
  const current = positions.every(position => position.valueCents !== null) ? positions.reduce((sum, position) => sum + position.valueCents!, 0) : null;
  return <div className={styles.charts}>
    <KqAllocationBar label="Répartition du capital investi" items={main} />
    <div>{current === null ? <p className={styles.unavailable}>Valeur actuelle indisponible · cours à actualiser</p> : <KqBarChart title="Investissement et valeur actuelle" items={[
      { label: "Capital investi", value: invested, displayValue: money(invested), tone: "ink" },
      { label: "Valeur actuelle", value: current, displayValue: money(current), tone: current >= invested ? "teal" : "red" },
    ]} />}</div>
  </div>;
}
