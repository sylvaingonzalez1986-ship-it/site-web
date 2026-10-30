import { RefreshCw } from "lucide-react";
import styles from "./KqCardChoiceDialog.module.css";

export function KqCardRecoveryNotice({ pending, checking, message, result, onCheck }: {
  pending: boolean; checking: boolean; message: string; result: string; onCheck: () => void;
}) {
  if (!pending) return result ? <p className={styles.recovered} data-card-recovery-status tabIndex={-1} role="status">{result}</p> : null;
  return <section className={styles.recovery} data-card-recovery>
    <h2>Carte à vérifier</h2>
    <p>La confirmation de la carte est incertaine. Les valeurs affichées sont à vérifier avant de continuer.</p>
    <p className={styles.recoveryStatus} data-card-recovery-status tabIndex={-1} role="status">{message}</p>
    <div className={styles.actions}><button type="button" className={styles.confirm} data-card-recovery-refresh disabled={checking} onClick={onCheck}>
      <RefreshCw size={17} aria-hidden="true" />{checking ? "Vérification…" : "Vérifier ma culture"}
    </button></div>
    <small>Vérifier ne dépense aucune carte ni aucun XP.</small>
  </section>;
}
