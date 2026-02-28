"use client";

import { siFacebook, siInstagram, siTiktok } from "simple-icons/icons";
import { normalizeExternalUrl } from "@/lib/external-url";
import type { Producer } from "@/types/store";

type ProducerSocialLinksProps = {
  links?: Producer["socialLinks"];
  producerName?: string;
  className?: string;
  compact?: boolean;
  stopPropagation?: boolean;
};

const SOCIAL_ICON_MAP = {
  instagram: { icon: siInstagram, label: "Instagram" },
  facebook: { icon: siFacebook, label: "Facebook" },
  tiktok: { icon: siTiktok, label: "TikTok" },
} as const;

type SocialKey = keyof typeof SOCIAL_ICON_MAP;

export function ProducerSocialLinks({
  links,
  producerName,
  className,
  compact = false,
  stopPropagation = false,
}: ProducerSocialLinksProps) {
  const items = (Object.keys(SOCIAL_ICON_MAP) as SocialKey[])
    .map((key) => {
      const url = normalizeExternalUrl(links?.[key] ?? "");
      if (!url) {
        return null;
      }

      const { icon, label } = SOCIAL_ICON_MAP[key];
      const ariaLabel = producerName ? `${label} de ${producerName}` : label;

      return (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className={`producer-social-link producer-social-link--${key}`}
          aria-label={ariaLabel}
          onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
            focusable="false"
            className="producer-social-icon"
          >
            <path d={icon.path} fill={`#${icon.hex}`} />
          </svg>
        </a>
      );
    })
    .filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`producer-social-links${compact ? " producer-social-links--compact" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {items}
    </div>
  );
}
