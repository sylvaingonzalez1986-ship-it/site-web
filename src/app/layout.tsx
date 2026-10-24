import { NavigationFeedbackProvider } from "@/components/navigation/NavigationFeedback";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { Footer } from "@/components/Footer";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/JsonLd";
import { NewProductsPopup } from "@/components/NewProductsPopup";
import { Navbar } from "@/components/Navbar";
import { SupabaseRecoveryRedirect } from "@/components/SupabaseRecoveryRedirect";
import { CookieConsentProvider } from "@/components/cookies/CookieConsentProvider";
import { COOKIE_CONSENT_COOKIE_NAME } from "@/components/cookies/cookie-consent-config";
import { parseConsentCookieValue } from "@/components/cookies/cookie-consent-utils";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { PendingPaymentRecoveryModal } from "@/components/checkout/PendingPaymentRecoveryModal";
import { WebVitals } from "@/components/WebVitals";
import { CartProvider } from "@/context/CartContext";
import { SiteUiMaterials } from "@/components/site-preview/SiteUiMaterials";
import { SiteUiPreview } from "@/components/site-preview/SiteUiPreview";
import { isSiteUiPreviewEnabled, SITE_UI_COOKIE, siteUiVariant } from "@/lib/site-ui-preview";
import "./globals.css";
import "./site-ui-preview.css";
import "@/components/site-preview/quartier-commerce.css";
import "@/components/site-preview/quartier-account.css";

const bodyFont = localFont({
  src: "./fonts/SpaceGrotesk-Latin-Variable.woff2",
  variable: "--font-body",
  weight: "400 700",
  style: "normal",
  display: "optional",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const displayFont = localFont({
  src: [
    { path: "./fonts/BarlowCondensed-Latin-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/BarlowCondensed-Latin-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "./fonts/BarlowCondensed-Latin-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
});

const handwrittenFont = localFont({
  src: "./fonts/Caveat-Latin-Bold.woff2",
  variable: "--font-handwritten",
  weight: "700",
  style: "normal",
  display: "swap",
  fallback: ["cursive", "Comic Sans MS"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.leschanvriersbretons.com"),
  icons: {
    icon: [
      { url: "/les-chanvriers-bretons-logo.png", type: "image/png", sizes: "800x800" },
    ],
    apple: [
      { url: "/les-chanvriers-bretons-logo.png", type: "image/png", sizes: "800x800" },
    ],
    shortcut: ["/les-chanvriers-bretons-logo.png"],
  },
  title: {
    default:
      "Les Chanvriers Bretons | CBD naturel, origine et traçabilité",
    template: "%s | Les Chanvriers Bretons",
  },
  description:
    "Maison bretonne consacrée au CBD et au chanvre : production propre et producteurs partenaires distingués, origine, composition et analyses disponibles par référence.",
  keywords: [
    "cbd naturel",
    "cbd breton",
    "producteur cbd bretagne",
    "fleur de cbd direct producteur",
    "achat cbd circuit court",
    "traçabilité cbd",
    "analyse laboratoire cbd",
    "tisane chanvre",
    "CBD Bretagne",
    "chanvre bretagne",
    "chanvre breton",
    "chanvrier breton",
    "boutique CBD",
    "shop CBD",
    "cbd légal",
    "cbd legal france",
    "fleur cbd",
    "fleurs cbd naturelles",
    "résine cbd",
    "résines cbd",
    "huile cbd",
    "huiles cbd spectre complet",
    "full spectrum cbd",
    "e-liquide cbd",
    "cosmétique cbd",
    "tisane cbd",
    "infusion chanvre",
    "livraison cbd france",
    "cbd artisanal",
    "les chanvriers bretons",
    "CBD Finistère",
    "CBD Côtes d'Armor",
    "CBD Morbihan",
    "CBD Ille-et-Vilaine",
    "producteur cbd breton",
    "origine cbd",
    "cbd pas cher",
  ],
  authors: [{ name: "Les Chanvriers Bretons" }],
  creator: "Les Chanvriers Bretons",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.leschanvriersbretons.com",
    siteName: "Les Chanvriers Bretons",
    title: "Les Chanvriers Bretons | CBD naturel, origine et traçabilité",
    description:
      "Production bretonne et références de producteurs partenaires clairement distinguées, avec origine, composition et analyses disponibles par produit.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Les Chanvriers Bretons – CBD naturel, origine et traçabilité",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Les Chanvriers Bretons | CBD naturel, origine et traçabilité",
    description:
      "Production bretonne et producteurs partenaires identifiés. Vérifiez l'origine, la composition et les analyses disponibles sur chaque référence.",
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.leschanvriersbretons.com",
    languages: {
      "fr-FR": "https://www.leschanvriersbretons.com",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const initialCookieConsent = parseConsentCookieValue(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? "");
  const uiPreviewEnabled = isSiteUiPreviewEnabled();
  const initialUiVariant = siteUiVariant(cookieStore.get(SITE_UI_COOKIE)?.value);
  return (
    <html lang="fr" nonce={nonce}>
      <head>
        <link
          rel="alternate"
          type="application/atom+xml"
          title="Les Chanvriers Bretons — guides et catalogue"
          href="/feed.xml"
        />
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}
      </head>
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${handwrittenFont.variable} bg-mint text-ink antialiased`}
      >
        <a href="#main-content" className="site-skip-link">Aller au contenu</a>
        {uiPreviewEnabled ? <><SiteUiMaterials /><SiteUiPreview initialVariant={initialUiVariant} /></> : null}
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        {process.env.NODE_ENV !== "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  if (!/([?&])navdebug=1(&|$)/.test(window.location.search)) return;
                  function show(message) {
                    var existing = document.getElementById("nav-debug-inline");
                    var node = existing || document.createElement("div");
                    node.id = "nav-debug-inline";
                    node.style.position = "fixed";
                    node.style.left = "8px";
                    node.style.right = "8px";
                    node.style.top = "96px";
                    node.style.zIndex = "99999";
                    node.style.padding = "8px";
                    node.style.border = "2px solid #1a1a1a";
                    node.style.background = "#fff7d6";
                    node.style.color = "#1a1a1a";
                    node.style.font = "700 11px system-ui, sans-serif";
                    node.textContent = message;
                    if (!existing) document.body.appendChild(node);
                  }
                  if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", function () {
                      show("inline-js-ok / react-not-yet");
                    });
                  } else {
                    show("inline-js-ok / react-not-yet");
                  }
                  window.addEventListener("error", function (event) {
                    show("js-error: " + (event.message || "unknown"));
                  });
                  window.addEventListener("unhandledrejection", function (event) {
                    show("promise-error: " + ((event.reason && event.reason.message) || event.reason || "unknown"));
                  });
                })();
              `,
            }}
          />
        )}
        <WebVitals />
        <NavigationFeedbackProvider>
        <CartProvider>
          <CookieConsentProvider initialConsent={initialCookieConsent}>
            <SupabaseRecoveryRedirect />
            <VercelAnalytics />
            <PendingPaymentRecoveryModal />
            <div className="site-background min-h-screen">
              <Navbar />
              <main id="main-content" tabIndex={-1} className="relative z-0">{children}</main>
              <Footer />
            </div>
            <NewProductsPopup />
          </CookieConsentProvider>
        </CartProvider>
        </NavigationFeedbackProvider>
      </body>
    </html>
  );
}
