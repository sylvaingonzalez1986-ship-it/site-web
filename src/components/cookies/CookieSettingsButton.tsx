"use client";

import { Cookie } from "lucide-react";

type CookieSettingsButtonProps = {
  onClick: () => void;
};

export function CookieSettingsButton({ onClick }: CookieSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-cartoon btn-secondary fixed bottom-4 left-4 z-[120] inline-flex min-h-[52px] items-center gap-2 px-4 py-3 text-[11px] shadow-[6px_6px_0_var(--ink)]"
      aria-label="Gerer mes preferences cookies"
    >
      <Cookie size={18} aria-hidden="true" />
      <span>Cookies</span>
    </button>
  );
}
