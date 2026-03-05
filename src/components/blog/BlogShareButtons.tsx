"use client";

import { useState } from "react";

type BlogShareButtonsProps = {
  url: string;
  title: string;
  excerpt: string;
};

function encode(value: string): string {
  return encodeURIComponent(value);
}

export function BlogShareButtons({ url, title, excerpt }: BlogShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const text = `${title} - ${excerpt}`;

  const links = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encode(url)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encode(url)}&text=${encode(text)}` },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encode(url)}`,
    },
    { label: "WhatsApp", href: `https://wa.me/?text=${encode(`${text} ${url}`)}` },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="cartoon-border bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">Partager cet article</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs"
          >
            {item.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="btn-cartoon btn-primary inline-flex h-10 items-center px-4 text-xs"
        >
          {copied ? "Lien copie" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
