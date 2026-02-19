import Image from "next/image";
import Link from "next/link";

type HeroProps = {
  eyebrow: string;
  titleTop: string;
  titleBottom: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  mascotSrc: string;
  mascotAlt: string;
};

export function Hero({
  eyebrow,
  titleTop,
  titleBottom,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  mascotSrc,
  mascotAlt,
}: HeroProps) {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-28 md:pt-32">
      <div className="retro-container hero-grid items-center gap-6">
        <div className="cartoon-border relative min-h-[420px] overflow-hidden bg-cream p-4 md:min-h-[560px]">
          <Image
            src={mascotSrc}
            alt={mascotAlt}
            fill
            priority
            className="object-contain object-bottom"
          />
        </div>

        <div className="relative z-10">
          {eyebrow.trim() ? (
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.14em]">{eyebrow}</p>
          ) : null}
          <h1 className="mt-6 font-handwritten text-[clamp(54px,9vw,112px)] leading-[0.82] text-ink">
            <span className="block">{titleTop}</span>
            <span className="block">{titleBottom}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-charcoal">{description}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={primaryHref} className="btn-cartoon btn-primary">
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref} className="btn-cartoon btn-secondary">
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
