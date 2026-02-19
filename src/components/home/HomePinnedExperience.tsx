"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import type { Product } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { CmsStore, HomeSection } from "@/types/store";

gsap.registerPlugin(ScrollTrigger);
type HomeContent = CmsStore["content"]["home"];
const HERO_ASSET_VERSION = "20260216-4";
const HERO_FRAME_IDLE_SRC = `/hero-circle-idle.png?v=${HERO_ASSET_VERSION}`;
const HERO_FRAME_SCENE_SRC = `/hero-bretagne-bg.png?v=${HERO_ASSET_VERSION}`;
const LEGAL_FRAME_BG_SRC = `/legal-circle-bg.png?v=${HERO_ASSET_VERSION}`;
const PRODUCTS_FRAME_BG_SRC = `/products-circle-bg.png?v=${HERO_ASSET_VERSION}`;

export function HomePinnedExperience() {
  const snapTriggerRef = useRef<ScrollTrigger | null>(null);
  const { store } = useCmsStore();
  const home = store.content.home;
  const featuredProducts = store.products.slice(0, 3);
  const homeSections = useMemo(
    () => store.sections.home.filter((section) => section.visible),
    [store.sections.home],
  );
  const homeSectionsKey = useMemo(
    () =>
      homeSections
        .map((section) => `${section.id}:${section.type}`)
        .join("|"),
    [homeSections],
  );

  useEffect(() => {
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
  }, [homeSectionsKey, store.updatedAt]);

  const renderHomeSection = (section: HomeSection, index: number) => {
    const zIndex = (index + 1) * 10;

    switch (section.type) {
      case "hero":
        return (
          <HeroPinnedSection key={section.id} home={home} zIndex={zIndex} />
        );
      case "legal":
        return (
          <LegalPinnedSection key={section.id} home={home} zIndex={zIndex} />
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
              <form className="mt-6 grid gap-3 md:grid-cols-3">
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
                  placeholder={home.contactNamePlaceholder}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
                  placeholder={home.contactEmailPlaceholder}
                />
                <button type="submit" className="btn-cartoon btn-primary h-12">
                  {home.contactSubmitLabel}
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

  return (
    <div className="relative overflow-x-hidden">
      {homeSections.map((section, index) => renderHomeSection(section, index))}
    </div>
  );
}

function HeroPinnedSection({ home, zIndex }: { home: HomeContent; zIndex: number }) {
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
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
        const loadTl = gsap.timeline({ defaults: { ease: "power3.out" } });

        loadTl.fromTo(
          card,
          { x: "-40vw", scale: 0.9, opacity: 0 },
          { x: 0, scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.4)" },
        );

        loadTl.fromTo(
          mascot,
          { y: "20vh", scale: 0.85, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "back.out(1.6)" },
          "-=0.5",
        );

        loadTl.fromTo(
          lines,
          { x: "35vw", opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7, stagger: 0.08 },
          "-=0.6",
        );

        loadTl.fromTo(
          subheadline,
          { y: "6vh", opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          "-=0.4",
        );
        loadTl.fromTo(
          ctaChildren,
          { y: "6vh", opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.06 },
          "-=0.3",
        );

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

      mm.add("(max-width: 768px)", () => {
        const mobileTargets = [card, mascot, ...Array.from(lines), subheadline, ...ctaChildren];
        gsap.fromTo(
          mobileTargets,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            stagger: 0.06,
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
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-pinned pinned-hero bg-mint halftone-overlay paper-grain"
      style={{ zIndex }}
    >
        <div
          ref={cardRef}
          className="hero-circle-group absolute left-[8vw] top-[15vh] h-[38vw] w-[38vw] max-h-[70vh] max-w-[70vh] overflow-hidden rounded-full bg-cream cartoon-border outline outline-[8px] outline-white z-10"
        >
          <div className="absolute inset-0 z-0 bg-cream" aria-hidden="true" />
          <div
            className="hero-circle-idle absolute inset-0 z-[1] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${HERO_FRAME_IDLE_SRC})` }}
            aria-hidden="true"
          />
          <div className="hero-circle-hover-scene absolute inset-0 z-[3]" aria-hidden="true">
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${HERO_FRAME_SCENE_SRC})` }}
            />
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/10 via-transparent to-transparent" />
            <div
              ref={mascotRef}
              className="pinned-mascot absolute left-1/2 bottom-0 z-10 h-[85%] w-[90%] -translate-x-1/2"
            >
              <Image
                src="/charles.png"
                alt="Charles"
                fill
                priority
                sizes="(max-width: 768px) 60vw, 34vw"
                className="object-contain object-bottom drop-shadow-[0_8px_10px_rgba(26,26,26,0.28)]"
              />
            </div>
          </div>
        </div>

      <div ref={headlineRef} className="pinned-headline absolute left-[52vw] top-[14vh] w-[42vw] z-20">
        <h1 className="pinned-title leading-[0.92] tracking-[0.01em] text-ink">
          <span className="headline-line block text-[clamp(48px,7vw,96px)]">{home.heroLine1}</span>
          <span className="headline-line block text-[clamp(48px,7vw,96px)]">{home.heroLine2}</span>
          <span className="headline-line block text-[clamp(48px,7vw,96px)]">{home.heroLine3}</span>
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
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
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
  }, []);

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
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${LEGAL_FRAME_BG_SRC})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#1a1a1a]/15 via-transparent to-transparent" />
        <div className="legal-character absolute left-1/2 bottom-0 z-10 h-[85%] w-[90%] -translate-x-1/2">
          <Image
            src="/sylvain.png"
            alt="Sylvain"
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
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
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
  }, []);

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
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${PRODUCTS_FRAME_BG_SRC})` }}
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
                    <span className="price-original">{home.productsPricePrefix} {formatPrice(product.originalPrice)} TTC</span>
                    <span className="price-promo">{home.productsPricePrefix} {formatPrice(product.price)} TTC</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs uppercase tracking-wide text-charcoal">
                    {home.productsPricePrefix} {formatPrice(product.price)} TTC
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
  const sectionRef = useRef<HTMLElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
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
  }, []);

  return (
    <section
      ref={sectionRef}
      id="app"
      className="section-pinned pinned-app bg-mint halftone-overlay paper-grain"
      style={{ zIndex }}
    >
      <div ref={mascotRef} className="pinned-mascot absolute left-[6vw] bottom-0 h-[78vh] w-[34vw] z-10">
        <Image src="/charles.png" alt="Charles app" fill className="object-contain object-bottom" />
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
