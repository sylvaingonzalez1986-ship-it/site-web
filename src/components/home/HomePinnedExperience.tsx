"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Apple,
  ArrowRight,
  FlaskConical,
  Play,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";
import { CustomSection } from "@/components/CustomSection";
import { HomeBadgePromoBand } from "@/components/home/HomeBadgePromoBand";
import { HomeSeasonGallery } from "@/components/home/HomeSeasonGallery";
import { HomeTicketPromoBand } from "@/components/home/HomeTicketPromoBand";
import type { Product } from "@/data/products";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { CmsStore, HomeSection, PublicStoreResponse } from "@/types/store";

type GsapRuntime = {
  gsap: (typeof import("gsap"))["gsap"];
  ScrollTrigger: (typeof import("gsap/ScrollTrigger"))["ScrollTrigger"];
};

let gsapRuntimePromise: Promise<GsapRuntime> | null = null;

function loadGsapRuntime(): Promise<GsapRuntime> {
  if (!gsapRuntimePromise) {
    gsapRuntimePromise = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        const runtime = {
          gsap: gsapModule.gsap,
          ScrollTrigger: scrollTriggerModule.ScrollTrigger,
        };
        runtime.gsap.registerPlugin(runtime.ScrollTrigger);
        return runtime;
      },
    );
  }

  return gsapRuntimePromise;
}

function useGsapRuntime() {
  const [runtime, setRuntime] = useState<GsapRuntime | null>(null);

  useEffect(() => {
    let active = true;
    void loadGsapRuntime().then((resolvedRuntime) => {
      if (active) {
        setRuntime(resolvedRuntime);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return runtime;
}

type HomeContent = CmsStore["content"]["home"];
const HERO_ASSET_VERSION = "20260216-4";
const HERO_FRAME_IDLE_SRC = `/hero-bretagne-bg.png?v=${HERO_ASSET_VERSION}`;
const HERO_FRAME_SCENE_SRC = `/hero-bretagne-bg.png?v=${HERO_ASSET_VERSION}`;
const LEGAL_FRAME_BG_SRC = `/legal-circle-bg.png?v=${HERO_ASSET_VERSION}`;
const PRODUCTS_FRAME_BG_SRC = `/products-circle-bg.png?v=${HERO_ASSET_VERSION}`;
const HOME_ALLOWED_TYPES = new Set(["hero", "products", "custom"]);
const HOME_SECTION_ORDER: Record<string, number> = {
  hero: 0,
  products: 1,
  app: 3,
  story: 4,
  contact: 5,
  custom: 6,
};

type HomePinnedExperienceProps = {
  initialStore: PublicStoreResponse;
};

export function HomePinnedExperience({ initialStore }: HomePinnedExperienceProps) {
  const gsapRuntime = useGsapRuntime();
  const snapTriggerRef = useRef<{ kill: () => void } | null>(null);
  const store = initialStore;
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const home = store.content.home;
  const featuredProducts = store.products.slice(0, 3);
  const homeSections = useMemo(() => {
    return store.sections.home
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.visible && HOME_ALLOWED_TYPES.has(section.type))
      .sort((a, b) => {
        const orderA = HOME_SECTION_ORDER[a.section.type] ?? 999;
        const orderB = HOME_SECTION_ORDER[b.section.type] ?? 999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.index - b.index;
      })
      .map(({ section }) => section);
  }, [store.sections.home]);
  const homeSectionsKey = useMemo(
    () =>
      homeSections
        .map((section) => `${section.id}:${section.type}`)
        .join("|"),
    [homeSections],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (isMobileViewport !== false || !gsapRuntime) {
      return;
    }

    const { gsap, ScrollTrigger } = gsapRuntime;

    const mm = gsap.matchMedia();

    mm.add("(min-width: 769px)", () => {
      const timeout = window.setTimeout(() => {
        const pinned = ScrollTrigger.getAll()
          .filter((st) => st.vars.pin)
          .sort((a, b) => a.start - b.start);

        const maxScroll = ScrollTrigger.maxScroll(window);

        if (!maxScroll || pinned.length === 0) {
          return;
        }

        const ranges = pinned.map((st) => {
          const end = st.end ?? st.start;
          return {
            start: st.start / maxScroll,
            end: end / maxScroll,
            center: (st.start + (end - st.start) * 0.5) / maxScroll,
          };
        });

        snapTriggerRef.current = ScrollTrigger.create({
          snap: {
            snapTo: (value: number) => {
              const inPinned = ranges.some(
                (range) => value >= range.start - 0.02 && value <= range.end + 0.02,
              );

              if (!inPinned) {
                return value;
              }

              return ranges.reduce(
                (closest, range) =>
                  Math.abs(range.center - value) < Math.abs(closest - value)
                    ? range.center
                    : closest,
                ranges[0]?.center ?? value,
              );
            },
            duration: { min: 0.15, max: 0.35 },
            delay: 0,
            ease: "power2.out",
          },
        });

        ScrollTrigger.refresh();
      }, 120);

      return () => {
        clearTimeout(timeout);
        snapTriggerRef.current?.kill();
        snapTriggerRef.current = null;
      };
    });

    return () => {
      mm.revert();
      snapTriggerRef.current?.kill();
      snapTriggerRef.current = null;
    };
  }, [gsapRuntime, homeSectionsKey, isMobileViewport, store.updatedAt]);

  const submitHomeContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError(null);
    setContactSuccess(null);

    const name = contactName.trim();
    const email = contactEmail.trim().toLowerCase();
    const message = contactMessage.trim();

    if (name.length < 2 || email.length === 0 || message.length < 10) {
      setContactError("Complète le formulaire avant l'envoi.");
      return;
    }

    setContactLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone: "",
          message,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setContactError(data.error ?? "Envoi impossible. Réessaie plus tard.");
        return;
      }

      setContactSuccess("Message envoyé. Nous reviendrons vers toi rapidement.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch {
      setContactError("Erreur réseau. Réessaie dans quelques minutes.");
    } finally {
      setContactLoading(false);
    }
  };

  const renderHomeSection = (section: HomeSection, index: number) => {
    const zIndex = (index + 1) * 10;

    switch (section.type) {
      case "hero":
        return (
          <div key={section.id}>
            <HeroPinnedSection home={home} zIndex={zIndex} />
            <HomeTicketPromoBand zIndex={zIndex + 1} />
            <HomeBadgePromoBand zIndex={zIndex + 2} />
            <HomeSeasonGallery
              title={home.seasonGalleryTitle}
              images={home.seasonGalleryImages}
              zIndex={zIndex + 3}
              decorativeBackgroundSrc={LEGAL_FRAME_BG_SRC}
              mascotSrc="/sylvain.png"
            />
          </div>
        );
      case "products":
        return (
          <ProductsPinnedSection
            key={section.id}
            featuredProducts={featuredProducts}
            home={home}
            zIndex={zIndex}
          />
        );
      case "app":
        return <AppPinnedSection key={section.id} zIndex={zIndex} home={home} />;
      case "story":
        return (
          <section
            key={section.id}
            id="story"
            className="section-band bg-yellow halftone-overlay paper-grain"
            style={{ zIndex }}
          >
            <div className="retro-container">
              <h2 className="section-title">{home.storyTitle}</h2>
              <p className="mt-6 max-w-3xl text-lg text-charcoal">
                {home.storyDescription}
              </p>
            </div>
          </section>
        );
      case "contact":
        return (
          <section
            key={section.id}
            id="contact"
            className="section-band bg-mint halftone-overlay paper-grain pb-20"
            style={{ zIndex }}
          >
            <div className="retro-container cartoon-border bg-cream p-8 md:p-10">
              <h2 className="section-title">{home.contactTitle}</h2>
              <p className="mt-4 max-w-2xl text-lg text-charcoal">
                {home.contactDescription}
              </p>
              <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={submitHomeContact}>
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
                  placeholder={home.contactNamePlaceholder}
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
                <input
                  type="email"
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
                  placeholder={home.contactEmailPlaceholder}
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
                <textarea
                  className="min-h-28 border-2 border-[#1a1a1a] bg-white p-4 text-base md:col-span-2"
                  placeholder="Ton message"
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                />
                {contactError && (
                  <p className="text-sm font-semibold text-red-700 md:col-span-2">{contactError}</p>
                )}
                {contactSuccess && (
                  <p className="text-sm font-semibold text-green-700 md:col-span-2">{contactSuccess}</p>
                )}
                <button
                  type="submit"
                  className="btn-cartoon btn-primary h-12 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={contactLoading}
                >
                  {contactLoading ? "Envoi..." : home.contactSubmitLabel}
                </button>
              </form>
            </div>
          </section>
        );
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="band"
            zIndex={zIndex}
          />
        );
      default:
        return null;
    }
  };

  const renderMobileHomeSection = (section: HomeSection, index: number) => {
    const zIndex = (index + 1) * 10;

    switch (section.type) {
      case "hero":
        return (
          <div key={section.id}>
            <MobileHeroSection home={home} zIndex={zIndex} />
            <HomeTicketPromoBand zIndex={zIndex + 1} />
            <HomeBadgePromoBand zIndex={zIndex + 2} />
            <HomeSeasonGallery
              title={home.seasonGalleryTitle}
              images={home.seasonGalleryImages}
              zIndex={zIndex + 3}
              decorativeBackgroundSrc={LEGAL_FRAME_BG_SRC}
              mascotSrc="/sylvain.png"
            />
          </div>
        );
      case "products":
        return (
          <MobileProductsSection
            key={section.id}
            featuredProducts={featuredProducts}
            home={home}
            zIndex={zIndex}
          />
        );
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="band"
            zIndex={zIndex}
          />
        );
      default:
        return null;
    }
  };

  if (isMobileViewport) {
    return (
      <div className="relative overflow-x-hidden">
        {homeSections.map((section, index) => renderMobileHomeSection(section, index))}

        {/* SEO – crawlable paragraph about the agricultural approach */}
        <section className="section-band bg-cream paper-grain py-12" style={{ zIndex: (homeSections.length + 1) * 10 }}>
          <div className="retro-container">
            <div className="cartoon-border bg-white/80 p-6">
              <h2 className="font-display text-2xl text-ink">
                CBD naturel direct producteur en Bretagne
              </h2>
              <div className="mt-4 space-y-3 text-base leading-relaxed text-charcoal">
                <p>
                  Les Chanvriers Bretons, c&apos;est avant tout une aventure de{" "}
                  <strong>producteur CBD en Bretagne</strong>. Sur notre exploitation,
                  nous cultivons du chanvre naturel, sans pesticide, avec le savoir-faire
                  du terroir breton. Notre boutique vous propose notre petite production
                  à prix juste, celle de nos voisins bretons et celle de quelques
                  producteurs français sélectionnés — parce qu&apos;on a tellement de
                  terroir à découvrir.
                </p>
                <p>
                  En achetant vos <strong>fleurs de CBD direct producteur</strong>, vos
                  huiles spectre complet ou vos{" "}
                  <strong>tisanes chanvre artisanales</strong>, vous faites le choix d&apos;un{" "}
                  <strong>achat CBD en circuit court</strong>, transparent et traçable.
                  Chaque lot est analysé en laboratoire pour garantir un{" "}
                  <strong>CBD français sans pesticide</strong>, conforme à la
                  réglementation en vigueur.
                </p>
                <p>
                  De la graine à votre porte, nous maîtrisons la chaîne :{" "}
                  <strong>CBD naturel</strong>, <strong>CBD breton</strong>, livré
                  rapidement partout en France. Bienvenue chez les chanvriers.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-hidden">
      {homeSections.map((section, index) => renderHomeSection(section, index))}

      {/* SEO – crawlable paragraph about the agricultural approach */}
      <section className="section-band bg-cream paper-grain py-12" style={{ zIndex: (homeSections.length + 1) * 10 }}>
        <div className="retro-container">
          <div className="cartoon-border bg-white/80 p-6 md:p-8">
            <h2 className="font-display text-2xl text-ink md:text-3xl">
              CBD naturel direct producteur en Bretagne
            </h2>
            <div className="mt-4 space-y-3 text-base leading-relaxed text-charcoal">
              <p>
                Les Chanvriers Bretons, c&apos;est avant tout une aventure de{" "}
                <strong>producteur CBD en Bretagne</strong>. Sur notre exploitation,
                nous cultivons du chanvre naturel, sans pesticide, avec le savoir-faire
                du terroir breton. Notre boutique vous propose notre petite production
                à prix juste, celle de nos voisins bretons et celle de quelques
                producteurs français sélectionnés — parce qu&apos;on a tellement de
                terroir à découvrir.
              </p>
              <p>
                En achetant vos <strong>fleurs de CBD direct producteur</strong>, vos
                huiles spectre complet ou vos{" "}
                <strong>tisanes chanvre artisanales</strong>, vous faites le choix d&apos;un{" "}
                <strong>achat CBD en circuit court</strong>, transparent et traçable.
                Chaque lot est analysé en laboratoire pour garantir un{" "}
                <strong>CBD français sans pesticide</strong>, conforme à la
                réglementation en vigueur.
              </p>
              <p>
                De la graine à votre porte, nous maîtrisons la chaîne :{" "}
                <strong>CBD naturel</strong>, <strong>CBD breton</strong>, livré
                rapidement partout en France. Bienvenue chez les chanvriers.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MobileHeroSection({ home, zIndex }: { home: HomeContent; zIndex: number }) {
  const renderedHeroLines = [home.heroLine1, home.heroLine2, home.heroLine3]
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <section
      className="section-band bg-mint halftone-overlay paper-grain pt-28"
      style={{ zIndex }}
      data-tutorial="home-hero"
    >
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-5">
          <h1 className="pinned-title text-ink">
            {renderedHeroLines.map((line, index) => (
              <span key={`${line}-${index}`} className="headline-line block text-[clamp(40px,14vw,72px)] leading-[0.9]">
                {line}
              </span>
            ))}
          </h1>

          <div className="hero-circle-group relative mx-auto mt-4 h-[72vw] w-[72vw] max-h-[330px] max-w-[330px] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[6px] outline-white">
            <div className="absolute inset-0 z-0 bg-cream" aria-hidden="true" />
            <Image
              src={HERO_FRAME_IDLE_SRC}
              alt=""
              fill
              priority
              sizes="72vw"
              className="absolute inset-0 z-[1] object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 z-[2] bg-gradient-to-t from-[#1a1a1a]/10 via-transparent to-transparent" />
            <div className="absolute left-1/2 bottom-0 z-10 h-[92%] w-[96%] -translate-x-1/2">
              <Image
                src="/sylvain.png"
                alt="Sylvain, fondateur Les Chanvriers Bretons – producteur CBD naturel en Bretagne"
                fill
                priority
                sizes="72vw"
                className="object-contain object-bottom drop-shadow-[0_8px_10px_rgba(26,26,26,0.28)]"
              />
            </div>
          </div>

          <p className="mt-5 text-lg leading-relaxed text-charcoal">{home.heroDescription}</p>
          <div className="mt-5">
            <Link href="/boutique" className="btn-primary btn-cartoon inline-flex min-h-[48px] items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {home.heroPrimaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileLegalSection({ home, zIndex }: { home: HomeContent; zIndex: number }) {
  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain" style={{ zIndex }}>
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-5">
          <div className="relative mx-auto h-[68vw] w-[68vw] max-h-[310px] max-w-[310px] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[6px] outline-white">
            <Image
              src={LEGAL_FRAME_BG_SRC}
              alt=""
              fill
              sizes="68vw"
              className="absolute inset-0 z-0 object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/15 via-transparent to-transparent" />
            <div className="absolute left-1/2 bottom-0 z-10 h-[92%] w-[96%] -translate-x-1/2">
              <Image
                src="/sylvain.png"
                alt="Sylvain, fondateur et producteur CBD Bretagne – achat CBD circuit court sans pesticide"
                fill
                sizes="68vw"
                className="object-contain object-bottom drop-shadow-[0_8px_10px_rgba(26,26,26,0.28)]"
              />
            </div>
          </div>
          <h2 className="pinned-title mt-4 leading-none text-ink">
            <span className="headline-line block text-[clamp(34px,12vw,58px)]">{home.legalLine1}</span>
            <span className="headline-line block text-[clamp(34px,12vw,58px)]">{home.legalLine2}</span>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-charcoal">{home.legalDescription}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="pill-cartoon flex items-center gap-2 px-3 py-2 text-xs">
              <Shield className="h-4 w-4" /> {home.legalPillThc}
            </div>
            <div className="pill-cartoon flex items-center gap-2 px-3 py-2 text-xs">
              <FlaskConical className="h-4 w-4" /> {home.legalPillLab}
            </div>
            <div className="pill-cartoon flex items-center gap-2 px-3 py-2 text-xs">
              <Truck className="h-4 w-4" /> {home.legalPillDelivery}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileProductsSection({
  featuredProducts,
  home,
  zIndex,
}: {
  featuredProducts: Product[];
  home: HomeContent;
  zIndex: number;
}) {
  return (
    <section id="products" className="section-band bg-mint halftone-overlay paper-grain pb-10" style={{ zIndex }}>
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-5">
          <h2 className="pinned-title leading-none text-ink">
            <span className="headline-line block text-[clamp(34px,12vw,58px)]">{home.productsTitleLine1}</span>
            <span className="headline-line block text-[clamp(34px,12vw,58px)]">{home.productsTitleLine2}</span>
          </h2>

          <div className="mt-5 grid gap-4">
            {featuredProducts.map((product) => {
              const hasPromo = hasActiveProductPromo(product);
              return (
                <article key={product.id} className="product-card card-cartoon overflow-hidden bg-white p-0">
                  <ProductImageCarousel
                    images={product.images?.length ? product.images : [product.image]}
                    alt={product.name}
                    badge={product.badge}
                    promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
                    className="border-b-2 border-[#1a1a1a]"
                    sizes="92vw"
                  />
                  <div className="p-3">
                    <h3 className="font-display text-xl text-ink">{product.name}</h3>
                    {hasPromo ? (
                      <div className="mt-1 flex flex-col text-xs uppercase tracking-wide">
                        <span className="price-original">
                          {home.productsPricePrefix} {formatPrice(product.originalPrice)}{product.category === "fleurs" && " / g"} TTC
                        </span>
                        <span className="price-promo">
                          {home.productsPricePrefix} {formatPrice(product.price)}{product.category === "fleurs" && " / g"} TTC
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs uppercase tracking-wide text-charcoal">
                        {home.productsPricePrefix} {formatPrice(product.price)}{product.category === "fleurs" && " / g"} TTC
                      </p>
                    )}
                    <Link
                      href="/boutique"
                      className="btn-cartoon btn-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" /> {home.productsAddButtonLabel}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5">
            <Link href="/boutique" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink hover:text-orange">
              {home.productsCtaLabel}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPinnedSection({ home, zIndex }: { home: HomeContent; zIndex: number }) {
  const gsapRuntime = useGsapRuntime();
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const renderedHeroLines = [home.heroLine1, home.heroLine2, home.heroLine3]
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  useLayoutEffect(() => {
    if (!gsapRuntime) {
      return;
    }

    const { gsap } = gsapRuntime;
    const section = sectionRef.current;
    const mascot = mascotRef.current;
    const card = cardRef.current;
    const headline = headlineRef.current;
    const subheadline = subheadlineRef.current;
    const cta = ctaRef.current;

    if (!section || !mascot || !card || !headline || !subheadline || !cta) {
      return;
    }

    const lines = headline.querySelectorAll(".headline-line");
    const ctaChildren = Array.from(cta.children);
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(min-width: 769px)", () => {
        gsap.set(card, { x: 0, scale: 1, opacity: 1 });
        gsap.set(mascot, { y: 0, scale: 1, opacity: 1 });
        gsap.set(lines, { x: 0, y: 0, opacity: 1 });
        gsap.set(subheadline, { y: 0, opacity: 1 });
        gsap.set(ctaChildren, { y: 0, opacity: 1 });

        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=130%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onLeaveBack: () => {
              gsap.set(card, { x: 0, scale: 1, opacity: 1 });
              gsap.set(mascot, { y: 0, scale: 1, opacity: 1 });
              gsap.set(lines, { x: 0, y: 0, opacity: 1 });
              gsap.set(subheadline, { y: 0, opacity: 1 });
              gsap.set(ctaChildren, { y: 0, opacity: 1 });
            },
          },
        });

        scrollTl.fromTo(card, { x: 0, opacity: 1 }, { x: "-30vw", opacity: 0, ease: "power2.in" }, 0.7);
        scrollTl.fromTo(
          mascot,
          { y: 0, scale: 1, opacity: 1 },
          { y: "15vh", scale: 0.9, opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          lines,
          { x: 0, y: 0, opacity: 1 },
          { x: "25vw", y: "-10vh", opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          subheadline,
          { y: 0, opacity: 1 },
          { y: "8vh", opacity: 0, ease: "power2.in" },
          0.72,
        );
        scrollTl.fromTo(
          ctaChildren,
          { y: 0, opacity: 1 },
          { y: "8vh", opacity: 0, ease: "power2.in", stagger: 0.02 },
          0.74,
        );
      });
    }, section);

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [gsapRuntime]);

  return (
    <section
      ref={sectionRef}
      className="section-pinned pinned-hero bg-mint halftone-overlay paper-grain"
      style={{ zIndex }}
      data-tutorial="home-hero"
    >
        <div
          ref={cardRef}
          className="hero-circle-group absolute left-[8vw] top-[15vh] h-[38vw] w-[38vw] max-h-[70vh] max-w-[70vh] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[8px] outline-white z-10"
        >
          <div className="absolute inset-0 z-0 bg-cream" aria-hidden="true" />
          <Image
            src={HERO_FRAME_IDLE_SRC}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 60vw, 34vw"
            className="hero-circle-idle absolute inset-0 z-[1] object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/10 via-transparent to-transparent" />
          <div
            ref={mascotRef}
            className="pinned-mascot absolute left-1/2 bottom-0 z-[2] h-[92%] w-[96%] -translate-x-1/2"
          >
            <Image
              src="/sylvain.png"
              alt="Sylvain, fondateur Les Chanvriers Bretons – producteur CBD naturel en Bretagne"
              fill
              priority
              sizes="(max-width: 768px) 60vw, 34vw"
              className="object-contain object-bottom drop-shadow-[0_8px_10px_rgba(26,26,26,0.28)]"
            />
          </div>
          <div className="hero-circle-hover-scene absolute inset-0 z-[4] flex items-center justify-center" aria-hidden="true">
            <div className="absolute inset-0 bg-cream/80 backdrop-blur-sm" />
            <Image
              src="/hero-circle-idle.png"
              alt="Logo Les Chanvriers Bretons"
              fill
              sizes="34vw"
              className="relative z-[1] object-cover drop-shadow-lg"
            />
          </div>
        </div>

      <div ref={headlineRef} className="pinned-headline absolute left-[52vw] top-[14vh] w-[42vw] z-20">
        <h1 className="pinned-title leading-[0.92] tracking-[0.01em] text-ink">
          {renderedHeroLines.map((line, index) => (
            <span
              key={`${line}-${index}`}
              className="headline-line block text-[clamp(48px,7vw,96px)]"
            >
              {line}
            </span>
          ))}
        </h1>
      </div>

      <p
        ref={subheadlineRef}
        className="pinned-copy absolute left-[52vw] top-[54vh] w-[38vw] text-lg leading-relaxed text-charcoal z-20 md:text-xl"
      >
        {home.heroDescription}
      </p>

      <div ref={ctaRef} className="pinned-cta absolute left-[52vw] top-[68vh] z-20 flex flex-wrap gap-4">
        <Link href="/boutique" className="btn-primary btn-cartoon flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          {home.heroPrimaryCtaLabel}
        </Link>
      </div>

      <div
        className="absolute right-0 top-0 h-full w-[40vw] opacity-[0.12] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A1A 2px, transparent 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </section>
  );
}

function LegalPinnedSection({ home, zIndex }: { home: HomeContent; zIndex: number }) {
  const gsapRuntime = useGsapRuntime();
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!gsapRuntime) {
      return;
    }

    const { gsap } = gsapRuntime;
    const section = sectionRef.current;
    const mascot = mascotRef.current;
    const headline = headlineRef.current;
    const body = bodyRef.current;
    const pills = pillsRef.current;

    if (!section || !mascot || !headline || !body || !pills) {
      return;
    }

    const lines = headline.querySelectorAll(".headline-line");
    const pillItems = pills.querySelectorAll(".pill-item");
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(min-width: 769px)", () => {
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=130%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        scrollTl.fromTo(
          mascot,
          { x: "60vw", y: "12vh", rotation: 10, scale: 0.92, opacity: 0 },
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, ease: "power2.out" },
          0,
        );
        scrollTl.fromTo(
          lines,
          { x: "-40vw", opacity: 0 },
          { x: 0, opacity: 1, ease: "power3.out", stagger: 0.03 },
          0,
        );
        scrollTl.fromTo(body, { y: "8vh", opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out" }, 0.05);
        scrollTl.fromTo(
          pillItems,
          { y: "10vh", scale: 0.92, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, ease: "back.out(1.4)", stagger: 0.02 },
          0.1,
        );

        scrollTl.fromTo(
          mascot,
          { x: 0, y: 0, rotation: 0, opacity: 1 },
          { x: "35vw", y: "18vh", rotation: 10, opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          lines,
          { x: 0, y: 0, opacity: 1 },
          { x: "-20vw", y: "-8vh", opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(body, { y: 0, opacity: 1 }, { y: "6vh", opacity: 0, ease: "power2.in" }, 0.72);
        scrollTl.fromTo(
          pillItems,
          { y: 0, opacity: 1 },
          { y: "8vh", opacity: 0, ease: "power2.in", stagger: 0.01 },
          0.74,
        );
      });

      mm.add("(max-width: 768px)", () => {
        gsap.fromTo(
          [mascot, ...Array.from(lines), body, ...Array.from(pillItems)],
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            stagger: 0.05,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, section);

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [gsapRuntime]);

  return (
    <section
      ref={sectionRef}
      className="section-pinned pinned-legal bg-yellow halftone-overlay paper-grain"
      style={{ zIndex }}
    >
      <div
        ref={mascotRef}
        className="legal-circle-group pinned-mascot absolute right-[8vw] top-[15vh] h-[38vw] w-[38vw] max-h-[70vh] max-w-[70vh] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[8px] outline-white z-10"
      >
        <Image
          src={LEGAL_FRAME_BG_SRC}
          alt=""
          fill
          sizes="(max-width: 768px) 60vw, 34vw"
          className="absolute inset-0 z-0 object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/15 via-transparent to-transparent" />
        <div className="legal-character absolute left-1/2 bottom-0 z-10 h-[92%] w-[96%] -translate-x-1/2">
          <Image
            src="/sylvain.png"
            alt="Sylvain, fondateur et producteur CBD Bretagne – CBD français sans pesticide, circuit court"
            fill
            className="object-contain object-bottom drop-shadow-[0_8px_10px_rgba(26,26,26,0.28)]"
          />
        </div>
      </div>

      <div ref={headlineRef} className="pinned-headline absolute left-[8vw] top-[14vh] w-[46vw] z-20">
        <h2 className="pinned-title leading-none text-ink">
          <span className="headline-line block text-[clamp(44px,6vw,84px)]">{home.legalLine1}</span>
          <span className="headline-line block text-[clamp(44px,6vw,84px)]">{home.legalLine2}</span>
        </h2>
      </div>

      <p
        ref={bodyRef}
        className="pinned-copy absolute left-[8vw] top-[46vh] w-[40vw] text-lg leading-relaxed text-charcoal z-20 md:text-xl"
      >
        {home.legalDescription}
      </p>

      <div ref={pillsRef} className="pinned-cta absolute left-[8vw] top-[62vh] z-20 flex flex-wrap gap-3">
        <div className="pill-item pill-cartoon flex items-center gap-2 px-4 py-2 text-sm">
          <Shield className="h-4 w-4" /> {home.legalPillThc}
        </div>
        <div className="pill-item pill-cartoon flex items-center gap-2 px-4 py-2 text-sm">
          <FlaskConical className="h-4 w-4" /> {home.legalPillLab}
        </div>
        <div className="pill-item pill-cartoon flex items-center gap-2 px-4 py-2 text-sm">
          <Truck className="h-4 w-4" /> {home.legalPillDelivery}
        </div>
      </div>

      <div
        className="absolute left-0 top-0 h-full w-[30vw] opacity-[0.12] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A1A 2px, transparent 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </section>
  );
}

function ProductsPinnedSection({
  featuredProducts,
  home,
  zIndex,
}: {
  featuredProducts: Product[];
  home: HomeContent;
  zIndex: number;
}) {
  const gsapRuntime = useGsapRuntime();
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    if (!gsapRuntime) {
      return;
    }

    const { gsap } = gsapRuntime;
    const section = sectionRef.current;
    const mascot = mascotRef.current;
    const headline = headlineRef.current;
    const cards = cardsRef.current;
    const cta = ctaRef.current;

    if (!section || !mascot || !headline || !cards || !cta) {
      return;
    }

    const lines = headline.querySelectorAll(".headline-line");
    const cardItems = cards.querySelectorAll(".product-card");
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(min-width: 769px)", () => {
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=140%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        scrollTl.fromTo(
          mascot,
          { x: "-60vw", y: "12vh", rotation: -10, opacity: 0 },
          { x: 0, y: 0, rotation: 0, opacity: 1, ease: "power2.out" },
          0,
        );
        scrollTl.fromTo(
          lines,
          { x: "40vw", opacity: 0 },
          { x: 0, opacity: 1, ease: "power3.out", stagger: 0.03 },
          0,
        );
        scrollTl.fromTo(
          cardItems,
          { y: "18vh", scale: 0.92, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, ease: "back.out(1.3)", stagger: 0.03 },
          0.1,
        );
        scrollTl.fromTo(cta, { y: "10vh", opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out" }, 0.2);

        scrollTl.fromTo(
          mascot,
          { x: 0, y: 0, rotation: 0, opacity: 1 },
          { x: "-35vw", y: "18vh", rotation: -10, opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          lines,
          { x: 0, y: 0, opacity: 1 },
          { x: "20vw", y: "-8vh", opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          cardItems,
          { y: 0, opacity: 1 },
          { y: "12vh", opacity: 0, ease: "power2.in", stagger: 0.02 },
          0.72,
        );
        scrollTl.fromTo(cta, { y: 0, opacity: 1 }, { y: "8vh", opacity: 0, ease: "power2.in" }, 0.76);
      });

      mm.add("(max-width: 768px)", () => {
        gsap.fromTo(
          [mascot, ...Array.from(lines), ...Array.from(cardItems), cta],
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            stagger: 0.05,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, section);

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [gsapRuntime]);

  return (
    <section
      ref={sectionRef}
      id="products"
      className="section-pinned pinned-products bg-mint halftone-overlay paper-grain"
      style={{ zIndex }}
    >
      <div
        ref={mascotRef}
        className="products-circle-group pinned-mascot absolute left-[8vw] top-[15vh] h-[38vw] w-[38vw] max-h-[70vh] max-w-[70vh] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[8px] outline-white z-10"
      >
        <Image
          src={PRODUCTS_FRAME_BG_SRC}
          alt=""
          fill
          sizes="(max-width: 768px) 60vw, 34vw"
          className="absolute inset-0 z-0 object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/12 via-transparent to-transparent" />
      </div>

      <div ref={headlineRef} className="pinned-headline absolute left-[52vw] top-[14vh] w-[42vw] z-20">
        <h2 className="pinned-title leading-[0.92] tracking-[0.01em] text-ink">
          <span className="headline-line block text-[clamp(44px,6vw,84px)]">{home.productsTitleLine1}</span>
          <span className="headline-line block text-[clamp(44px,6vw,84px)]">{home.productsTitleLine2}</span>
        </h2>
      </div>

      <div
        ref={cardsRef}
        className="pinned-grid absolute left-[52vw] top-[43vh] z-20 grid w-[42vw] grid-cols-3 gap-[2.2vw]"
      >
        {featuredProducts.map((product) => {
          const hasPromo = hasActiveProductPromo(product);

          return (
            <article key={product.id} className="product-card card-cartoon overflow-hidden p-0">
              <ProductImageCarousel
                images={product.images?.length ? product.images : [product.image]}
                alt={product.name}
                badge={product.badge}
                promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
                className="border-b-2 border-[#1a1a1a]"
                sizes="(max-width: 768px) 84vw, 14vw"
              />
              <div className="p-3">
                <h3 className="font-display text-lg text-ink">{product.name}</h3>
                {hasPromo ? (
                  <div className="mt-1 flex flex-col text-xs uppercase tracking-wide">
                    <span className="price-original">{home.productsPricePrefix} {formatPrice(product.originalPrice)}{product.category === "fleurs" && " / g"} TTC</span>
                    <span className="price-promo">{home.productsPricePrefix} {formatPrice(product.price)}{product.category === "fleurs" && " / g"} TTC</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs uppercase tracking-wide text-charcoal">
                    {home.productsPricePrefix} {formatPrice(product.price)}{product.category === "fleurs" && " / g"} TTC
                  </p>
                )}
                <button className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 border-2 border-[#1a1a1a] bg-orange py-3 text-xs font-bold uppercase text-white">
                  <ShoppingCart className="h-4 w-4" /> {home.productsAddButtonLabel}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Link
        ref={ctaRef}
        href="/boutique"
        className="pinned-cta absolute left-[52vw] top-[88vh] z-20 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink hover:text-orange"
      >
        {home.productsCtaLabel}
        <ArrowRight className="h-5 w-5" />
      </Link>

      <div
        className="absolute right-0 top-0 h-full w-[40vw] opacity-[0.12] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A1A 2px, transparent 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </section>
  );
}

function AppPinnedSection({
  zIndex,
  home,
}: {
  zIndex: number;
  home: HomeContent;
}) {
  const gsapRuntime = useGsapRuntime();
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!gsapRuntime) {
      return;
    }

    const { gsap } = gsapRuntime;
    const section = sectionRef.current;
    const mascot = mascotRef.current;
    const headline = headlineRef.current;
    const subheadline = subheadlineRef.current;
    const badges = badgesRef.current;

    if (!section || !mascot || !headline || !subheadline || !badges) {
      return;
    }

    const lines = headline.querySelectorAll(".headline-line");
    const badgeItems = badges.querySelectorAll(".badge-item");
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(min-width: 769px)", () => {
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=130%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        scrollTl.fromTo(
          mascot,
          { x: "-60vw", y: "12vh", rotation: -10, opacity: 0 },
          { x: 0, y: 0, rotation: 0, opacity: 1, ease: "power2.out" },
          0,
        );
        scrollTl.fromTo(
          lines,
          { x: "40vw", opacity: 0 },
          { x: 0, opacity: 1, ease: "power3.out", stagger: 0.03 },
          0,
        );
        scrollTl.fromTo(
          subheadline,
          { y: "8vh", opacity: 0 },
          { y: 0, opacity: 1, ease: "power2.out" },
          0.1,
        );
        scrollTl.fromTo(
          badgeItems,
          { y: "8vh", opacity: 0 },
          { y: 0, opacity: 1, ease: "power2.out", stagger: 0.03 },
          0.15,
        );

        scrollTl.fromTo(
          mascot,
          { x: 0, y: 0, rotation: 0, opacity: 1 },
          { x: "-35vw", y: "18vh", rotation: -10, opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          lines,
          { x: 0, y: 0, opacity: 1 },
          { x: "20vw", y: "-8vh", opacity: 0, ease: "power2.in" },
          0.7,
        );
        scrollTl.fromTo(
          subheadline,
          { y: 0, opacity: 1 },
          { y: "6vh", opacity: 0, ease: "power2.in" },
          0.72,
        );
        scrollTl.fromTo(
          badgeItems,
          { y: 0, opacity: 1 },
          { y: "6vh", opacity: 0, ease: "power2.in", stagger: 0.02 },
          0.74,
        );
      });

      mm.add("(max-width: 768px)", () => {
        gsap.fromTo(
          [mascot, ...Array.from(lines), subheadline, ...Array.from(badgeItems)],
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            stagger: 0.05,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, section);

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [gsapRuntime]);

  return (
    <section
      ref={sectionRef}
      id="app"
      className="section-pinned pinned-app bg-mint halftone-overlay paper-grain"
      style={{ zIndex }}
    >
      <div ref={mascotRef} className="pinned-mascot absolute left-[6vw] bottom-0 h-[78vh] w-[34vw] z-10">
        <Image src="/sylvain.png" alt="Sylvain, fondateur Les Chanvriers Bretons – boutique CBD breton en ligne" fill className="object-contain object-bottom" />
      </div>

      <div ref={headlineRef} className="pinned-headline absolute left-[52vw] top-[14vh] w-[42vw] z-20">
        <h2 className="pinned-title leading-none text-ink">
          <span className="headline-line block text-[clamp(36px,5vw,72px)]">{home.appTitleLine1}</span>
          <span className="headline-line block text-[clamp(36px,5vw,72px)]">{home.appTitleLine2}</span>
          <span className="headline-line block text-[clamp(36px,5vw,72px)]">{home.appTitleLine3}</span>
        </h2>
      </div>

      <p
        ref={subheadlineRef}
        className="pinned-copy absolute left-[52vw] top-[52vh] w-[38vw] text-lg leading-relaxed text-charcoal z-20 md:text-xl"
      >
        {home.appDescription}
      </p>

      <div ref={badgesRef} className="pinned-cta absolute left-[52vw] top-[66vh] z-20 flex flex-wrap gap-4">
        <a
          href="#"
          className="badge-item flex items-center gap-3 border-2 border-[#1a1a1a] bg-[#1a1a1a] px-5 py-3 text-white"
        >
          <Apple className="h-6 w-6" />
          <span className="text-sm font-semibold">{home.appStoreLabel}</span>
        </a>
        <a
          href="#"
          className="badge-item flex items-center gap-3 border-2 border-[#1a1a1a] bg-[#1a1a1a] px-5 py-3 text-white"
        >
          <Play className="h-6 w-6" />
          <span className="text-sm font-semibold">{home.playStoreLabel}</span>
        </a>
      </div>

      <div className="pinned-app-promo absolute left-[52vw] top-[78vh] w-[38vw] z-20">
        <div className="flex items-center gap-4 border-2 border-[#1a1a1a] bg-cream p-4">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#1a1a1a] bg-teal text-lg font-display text-white">
            LCU
          </div>
          <div>
            <p className="font-semibold text-ink">{home.appProducerTitle}</p>
            <p className="text-sm text-charcoal">{home.appProducerDescription}</p>
          </div>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 h-full w-[40vw] opacity-[0.12] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A1A 2px, transparent 2px)",
          backgroundSize: "16px 16px",
        }}
      />
    </section>
  );
}
