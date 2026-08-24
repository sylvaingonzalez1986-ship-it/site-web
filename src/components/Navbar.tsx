"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCmsPages } from "@/hooks/useCmsPages";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

const CartDrawer = dynamic(
  () => import("@/components/CartDrawer").then((mod) => mod.CartDrawer),
  { ssr: false },
);

const baseLinks = [
  { href: "/", label: "Accueil" },
  { href: "/boutique", label: "Le Marché" },
  { href: "/arene", label: "L’Arène" },
  { href: "/blog", label: "Le Journal" },
];

const announcementMessage =
  "Ici, rien que du chanvre naturel — sans cannabinoïdes de synthèse ni artifices. Votre santé passe avant tout. Tous nos produits sont traçables jusqu’à leur producteur.";

function AnnouncementBanner() {
  const repeatedMessages = Array.from({ length: 3 }, (_, index) => (
    <span className="announcement-banner__item" key={index}>
      <span>{announcementMessage}</span>
      <span className="announcement-banner__separator" aria-hidden="true">
        ✦
      </span>
    </span>
  ));

  return (
    <aside
      className="announcement-banner"
      aria-label={announcementMessage}
    >
      <div className="announcement-banner__track" aria-hidden="true">
        <div className="announcement-banner__group">{repeatedMessages}</div>
        <div className="announcement-banner__group">{repeatedMessages}</div>
      </div>
    </aside>
  );
}

function isExplicitlyDisabled(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no";
}

const contestBetaAccessRestricted = !isExplicitlyDisabled(
  process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED,
);

type ContestAccessResponse = {
  canAccess?: boolean;
};

type ContestAccessCheck = {
  key: string;
  canAccess: boolean;
};

export function Navbar() {
  const pathname = usePathname();
  const showAnnouncement = pathname === "/";
  const { totalItems, user, loyalty, hasWelcomePack, sessionLoading } = useCart();
  const isAuthenticated = Boolean(user);
  const { pages: cmsPages } = useCmsPages();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hideWelcomePackBadge, setHideWelcomePackBadge] = useState(false);
  const [contestAccessCheck, setContestAccessCheck] = useState<ContestAccessCheck | null>(null);
  const contestAccessKey = user?.id || user?.email || "";

  // Hide badge instantly when pack is claimed elsewhere on the page
  useEffect(() => {
    const hide = () => setHideWelcomePackBadge(true);
    window.addEventListener("welcome-pack-claimed", hide);
    return () => window.removeEventListener("welcome-pack-claimed", hide);
  }, []);

  const cmsNavLinks = useMemo(
    () =>
      [...cmsPages]
        .filter((page) => page.showInNav)
        .sort((a, b) => a.position - b.position)
        .map((page) => ({
          href: `/${page.slug}`,
          label: page.navLabel.trim() || page.title,
        })),
    [cmsPages],
  );

  useEffect(() => {
    const hasContestAccessFromUser =
      user?.contestBetaEnabled === true || isAllowedAdminEmail(user?.email);

    if (
      !contestBetaAccessRestricted ||
      !isAuthenticated ||
      hasContestAccessFromUser ||
      !contestAccessKey
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const refreshContestAccess = async () => {
      try {
        const response = await fetch("/api/contest/access", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!cancelled) {
            setContestAccessCheck({ key: contestAccessKey, canAccess: false });
          }
          return;
        }

        const data = (await response.json()) as ContestAccessResponse;
        if (!cancelled) {
          setContestAccessCheck({ key: contestAccessKey, canAccess: data.canAccess === true });
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setContestAccessCheck({ key: contestAccessKey, canAccess: false });
        }
      }
    };

    void refreshContestAccess();
    window.addEventListener("focus", refreshContestAccess);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("focus", refreshContestAccess);
    };
  }, [contestAccessKey, isAuthenticated, user?.contestBetaEnabled, user?.email]);

  const links = useMemo(() => {
    const contestAccessAllowed =
      contestAccessCheck?.key === contestAccessKey && contestAccessCheck.canAccess;
    const canSeeContestLink =
      !contestBetaAccessRestricted ||
      contestAccessAllowed === true ||
      user?.contestBetaEnabled === true ||
      isAllowedAdminEmail(user?.email);
    const visibleBaseLinks = canSeeContestLink
      ? baseLinks
      : baseLinks.filter((link) => link.href !== "/arene");
    const merged = [
      ...visibleBaseLinks,
      { href: "/profil/collection", label: "L’Album" },
      ...cmsNavLinks,
      ...(isAllowedAdminEmail(user?.email) ? [{ href: "/admin", label: "Admin" }] : []),
      user
        ? { href: "/profil", label: "Profil" }
        : { href: "/compte/connexion", label: "Compte" },
    ];

    const byHref = new Map<string, { href: string; label: string }>();
    for (const link of merged) {
      if (!byHref.has(link.href)) {
        byHref.set(link.href, link);
      }
    }

    return Array.from(byHref.values());
  }, [cmsNavLinks, contestAccessCheck, contestAccessKey, user]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 56);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener("cart:open", openCart);
    return () => window.removeEventListener("cart:open", openCart);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useBodyScrollLock(menuOpen);

  // Les espaces de jeu possèdent leur propre navigation plein écran. Conserver
  // ici la barre globale fixe la placerait au-dessus de leurs boutons et modales.
  if (pathname === "/arene/placard" || pathname.startsWith("/arene/carnet")) {
    return null;
  }

  return (
    <>
      {showAnnouncement && <AnnouncementBanner />}
      <header
        data-tutorial="navbar"
        className={`game-navbar safe-area-x fixed inset-x-0 z-40 transition-all duration-300 ${
          showAnnouncement
            ? "top-[var(--announcement-banner-height)]"
            : "safe-area-top top-0"
        } ${
          isScrolled
            ? "is-scrolled py-3"
            : "bg-transparent py-6"
        }`}
      >
        <div className="retro-container relative flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#f7f4ee] text-2xl font-bold leading-none md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          <Link href="/" className="game-brand hidden font-display text-xl text-ink md:block md:text-2xl">
            Les Chanvriers Bretons
          </Link>

          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 md:hidden"
            aria-label="Accueil"
          >
            <Image
              src="/hero-circle-idle.png"
              alt="Logo Les Chanvriers Bretons"
              width={44}
              height={44}
              sizes="44px"
              className="h-11 w-11 object-contain"
            />
          </Link>

          <nav className="game-nav-links hidden items-center gap-2 md:flex">
            {links.map((link) => {
              const isAccountLink = link.href === "/profil" || link.href === "/compte/connexion";
              const isAlbumLink = link.href === "/profil/collection";
              const showWelcomePackBadge =
                isAlbumLink && !hideWelcomePackBadge && (!sessionLoading ? (isAuthenticated ? hasWelcomePack : true) : false);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isAccountLink && user ? "inline-flex items-center gap-2" : ""} ${showWelcomePackBadge ? "relative inline-flex items-center" : ""}`}
                  data-tutorial={
                    link.href === "/boutique"
                      ? "navbar-boutique"
                      : isAccountLink
                        ? "navbar-account"
                        : undefined
                  }
                >
                  <span>{link.label}</span>
                  {showWelcomePackBadge && (
                    <span className="absolute -right-2.5 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#27ae60] opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-[#27ae60]" />
                    </span>
                  )}
                  {link.href === "/profil" && user && (
                    <span
                      className="inline-flex items-center"
                      aria-label={`Badge actuel: ${loyalty.currentBadge.label}`}
                      title={`Badge actuel: ${loyalty.currentBadge.label}`}
                    >
                      <LoyaltyBadgeIllustration
                        badgeId={loyalty.currentBadge.id}
                        unlocked={loyalty.currentBadge.unlocked}
                        size="xs"
                      />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Panier"
            className="relative inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#f7f4ee]"
          >
            <ShoppingCart size={19} />
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#d35400] px-1 text-center text-xs font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <div
        id="mobile-nav"
        className={`game-mobile-nav fixed inset-0 z-30 transition-transform duration-300 md:hidden ${
          menuOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="safe-area-top safe-area-bottom safe-area-x flex h-full flex-col items-center justify-center gap-8 overflow-y-auto py-10">
          {links.map((link) => {
            const isAccountLink = link.href === "/profil" || link.href === "/compte/connexion";
              const isAlbumLink = link.href === "/profil/collection";
              const showWelcomePackBadge =
                isAlbumLink && !hideWelcomePackBadge && (!sessionLoading ? (isAuthenticated ? hasWelcomePack : true) : false);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`relative font-display text-3xl text-ink ${isAccountLink && user ? "inline-flex items-center gap-3" : ""}`}
                data-tutorial={
                  link.href === "/boutique"
                    ? "navbar-boutique"
                    : isAccountLink
                      ? "navbar-account"
                      : undefined
                }
              >
                <span>{link.label}</span>
                {showWelcomePackBadge && (
                  <span className="absolute -right-4 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#27ae60] opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-[#27ae60]" />
                  </span>
                )}
                {link.href === "/profil" && user && (
                  <span
                    className="inline-flex items-center"
                    aria-label={`Badge actuel: ${loyalty.currentBadge.label}`}
                    title={`Badge actuel: ${loyalty.currentBadge.label}`}
                  >
                    <LoyaltyBadgeIllustration
                      badgeId={loyalty.currentBadge.id}
                      unlocked={loyalty.currentBadge.unlocked}
                      size="xs"
                    />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
