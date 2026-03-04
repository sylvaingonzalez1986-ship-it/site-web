"use client";

type CartBenefitSummaryModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  hint?: string;
  lines: string[];
};

export function CartBenefitSummaryModal({
  open,
  onClose,
  title,
  eyebrow,
  hint,
  lines,
}: CartBenefitSummaryModalProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/45"
        aria-label="Fermer le recapitulatif"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div className="cartoon-border w-full max-w-md bg-[#fff9ef] p-5 shadow-[10px_10px_0_rgba(26,26,26,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal">{eyebrow}</p>
              <h3 className="mt-1 font-display text-3xl text-ink">{title}</h3>
              {hint ? <p className="mt-2 text-sm leading-relaxed text-charcoal">{hint}</p> : null}
            </div>
            <button
              type="button"
              className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3 text-xl font-bold"
              onClick={onClose}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          <ul className="mt-4 grid gap-2 text-sm leading-relaxed text-ink">
            {lines.map((line, index) => (
              <li key={`${eyebrow}-${index}`} className="rounded-[0.2rem] border-2 border-[#1a1a1a] bg-white px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
