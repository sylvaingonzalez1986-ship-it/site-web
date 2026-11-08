"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import styles from "./KqWorkActorSelector.module.css";

export type KqWorkActorOption = {
  id: string;
  name: string;
  portrait: ReactNode;
  detail?: string;
  disabledReason?: string;
};

/** Presentation only: each workshop supplies its own authorized actors and quote. */
export function KqWorkActorSelector({ label, options, value, onChange, disabled = false }: {
  label: string;
  options: KqWorkActorOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const name = useId();
  if (!options.length) return null;
  return <fieldset className={styles.selector} disabled={disabled} data-work-actor-selector>
    <legend>{label}</legend>
    <div className={styles.options}>
      {options.map(option => <label key={option.id} className={styles.option} data-selected={value === option.id || undefined} data-unavailable={!!option.disabledReason || undefined}>
        <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} disabled={!!option.disabledReason} data-work-actor-choice={option.id} />
        <span className={styles.portrait} aria-hidden="true">{option.portrait}</span>
        <span className={styles.copy}><strong>{option.name}</strong>{option.detail ? <span>{option.detail}</span> : null}{option.disabledReason ? <small>{option.disabledReason}</small> : null}</span>
        {value === option.id ? <Check className={styles.check} size={15} aria-hidden="true" /> : null}
      </label>)}
    </div>
  </fieldset>;
}
