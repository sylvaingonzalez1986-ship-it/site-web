"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCmsPages } from "@/hooks/useCmsPages";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

const baseLinks = [
  { href: "/", label: "Accueil" },
  { href: "/boutique", label: "Boutique" },
  { href: "/blog", label: "Blog" },
  { href: "/application", label: "App" },
];

export function Navbar() {
  const { totalItems } = useCart();
  const { user, loyalty } = useCustomerSession();
  const { pages: cmsPages } = useCmsPages();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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

  const links = useMemo(() => {
    const merged = [
      ...baseLinks,
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
  }, [cmsNavLinks, user]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 56);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <>
      <header
        data-tutorial="navbar"
        className={`safe-area-top safe-area-x fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? "bg-[#f7f4ee]/95 border-b-2 border-[#1a1a1a] py-3 backdrop-blur"
            : "bg-transparent py-6"
        }`}
      >
        <div className="retro-container relative flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#1a1a1a] bg-[#f7f4ee] md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="hidden font-display text-xl text-ink md:block md:text-2xl">
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
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((link) => {
              const isAccountLink = link.href === "/profil" || link.href === "/compte/connexion";

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isAccountLink && user ? "inline-flex items-center gap-2" : ""}`}
                  data-tutorial={
                    link.href === "/boutique"
                      ? "navbar-boutique"
                      : isAccountLink
                        ? "navbar-account"
                        : undefined
                  }
                >
                  <span>{link.label}</span>
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
        className={`fixed inset-0 z-30 bg-[#f7f4ee] transition-transform duration-300 md:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="safe-area-top safe-area-bottom safe-area-x flex h-full flex-col items-center justify-center gap-8 overflow-y-auto py-10">
          {links.map((link) => {
            const isAccountLink = link.href === "/profil" || link.href === "/compte/connexion";

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`font-display text-3xl text-ink ${isAccountLink && user ? "inline-flex items-center gap-3" : ""}`}
                data-tutorial={
                  link.href === "/boutique"
                    ? "navbar-boutique"
                    : isAccountLink
                      ? "navbar-account"
                      : undefined
                }
              >
                <span>{link.label}</span>
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
