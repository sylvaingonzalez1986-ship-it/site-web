"use client";

import Link from "next/link";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCustomerSession } from "@/hooks/useCustomerSession";

const baseLinks = [
  { href: "/", label: "Accueil" },
  { href: "/boutique", label: "Boutique" },
  { href: "/blog", label: "Blog" },
  { href: "/application", label: "App" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const { totalItems } = useCart();
  const { user } = useCustomerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const links = [
    ...baseLinks,
    user
      ? { href: "/profil", label: "Profil" }
      : { href: "/compte/connexion", label: "Compte" },
  ];

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
        className={`safe-area-top safe-area-x fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? "bg-[#f7f4ee]/95 border-b-2 border-[#1a1a1a] py-3 backdrop-blur"
            : "bg-transparent py-6"
        }`}
      >
        <div className="retro-container flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl text-ink md:text-2xl">
            Les Chanvriers Bretons
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <div
        id="mobile-nav"
        className={`fixed inset-0 z-30 bg-[#f7f4ee] transition-transform duration-300 md:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="safe-area-top safe-area-bottom safe-area-x flex h-full flex-col items-center justify-center gap-8 overflow-y-auto py-10">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-display text-3xl text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
