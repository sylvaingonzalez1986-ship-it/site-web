import Image from "next/image";
import type { ReactNode } from "react";

type EditorialWorldHeroProps = {
  world: "market" | "journal" | "progress";
  eyebrow?: string;
  title: string;
  description: ReactNode;
  imageSrc: string;
  imageAlt: string;
  className?: string;
  children?: ReactNode;
};

export function EditorialWorldHero({
  world,
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  className = "",
  children,
}: EditorialWorldHeroProps) {
  return (
    <header
      data-world={world}
      className={`world-hero editorial-world-hero cartoon-border bg-cream ${className}`.trim()}
    >
      <div className="editorial-world-hero__intro">
        <div className="editorial-world-hero__copy">
          {eyebrow ? (
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className={`section-title text-ink ${eyebrow ? "mt-5" : ""}`}>{title}</h1>
        </div>

        <div className="editorial-world-hero__character">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={1024}
            height={1536}
            sizes="(max-width: 767px) 25vw, 290px"
            priority
          />
        </div>

        <p className="editorial-world-hero__description text-charcoal">{description}</p>
      </div>

      {children ? <div className="editorial-world-hero__content">{children}</div> : null}
    </header>
  );
}
