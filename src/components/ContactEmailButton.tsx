"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";

export const CONTACT_EMAIL = "leschanvriersbretons@gmail.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

type ContactEmailButtonProps = {
  buttonClassName: string;
  iconClassName?: string;
  label: string;
  statusClassName?: string;
};

function isMobileLikeDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to execCommand below.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ContactEmailButton({
  buttonClassName,
  iconClassName,
  label,
  statusClassName = "mt-2 text-xs font-semibold text-ink",
}: ContactEmailButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatus(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const handleClick = async () => {
    if (isMobileLikeDevice()) {
      window.location.href = CONTACT_MAILTO;
      return;
    }

    const copied = await copyTextToClipboard(CONTACT_EMAIL);
    setStatus(
      copied
        ? "Adresse email copiee. Colle-la dans ta messagerie sur ordinateur."
        : `Copie impossible. Ecris-nous a ${CONTACT_EMAIL}.`,
    );
  };

  return (
    <div>
      <button type="button" onClick={() => void handleClick()} className={buttonClassName}>
        <Mail size={14} className={iconClassName} /> {label}
      </button>
      {status ? (
        <p role="status" aria-live="polite" className={statusClassName}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
