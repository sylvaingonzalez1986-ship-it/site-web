"use client";

import Link from "next/link";
import { Facebook, Instagram, Music2 } from "lucide-react";
import { useCmsStore } from "@/hooks/useCmsStore";

export function Footer() {
  const { store } = useCmsStore();
  const footer = store.content.footer;

  return (
    <footer className="bg-yellow halftone-overlay paper-grain border-t-2 border-[#1a1a1a] py-10">
      <div className="retro-container flex flex-col items-center justify-between gap-6 md:flex-row">
        <p className="text-sm text-charcoal">{footer.copyright}</p>

        <div className="flex gap-3">
          <Link
            href="#"
            className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white transition-colors hover:bg-[#d35400]"
            aria-label="Instagram"
          >
            <Instagram size={17} />
          </Link>
          <Link
            href="#"
            className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white transition-colors hover:bg-[#d35400]"
            aria-label="Facebook"
          >
            <Facebook size={17} />
          </Link>
          <Link
            href="#"
            className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white transition-colors hover:bg-[#d35400]"
            aria-label="TikTok"
          >
            <Music2 size={17} />
          </Link>
        </div>

        <div className="flex items-center gap-6 text-sm text-charcoal">
          <Link href="#" className="hover:text-[#d35400]">
            <span className="inline-block py-2">{footer.legalLabel}</span>
          </Link>
          <Link href="#" className="hover:text-[#d35400]">
            <span className="inline-block py-2">{footer.privacyLabel}</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
