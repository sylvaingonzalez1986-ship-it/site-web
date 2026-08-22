import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Caveat, Space_Grotesk } from "next/font/google";
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
import "./globals.css";

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "optional",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const displayFont = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
});

const handwrittenFont = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["700"],
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
      "Les Chanvriers Bretons | CBD Naturel Direct Producteur Bretagne - Livraison France",
    template: "%s | Les Chanvriers Bretons",
  },
  description:
    "CBD naturel en direct du producteur breton : fleurs de CBD, huiles, résines, tisanes chanvre artisanales. Achat CBD circuit court, sans pesticide, cultivé en Bretagne. Livraison rapide France.",
  keywords: [
    "cbd naturel",
    "cbd breton",
    "producteur cbd bretagne",
    "fleur de cbd direct producteur",
    "achat cbd circuit court",
    "cbd français sans pesticide",
    "tisane chanvre artisanale",
    "CBD bio",
    "CBD bio breton",
    "CBD Bretagne",
    "chanvre bretagne",
    "chanvre breton",
    "chanvrier breton",
    "boutique CBD",
    "shop CBD",
    "cbd légal",
    "cbd legal france",
    "fleur cbd",
    "fleurs cbd bio",
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
    "chanvre bio breton",
    "cbd pas cher",
  ],
  authors: [{ name: "Les Chanvriers Bretons" }],
  creator: "Les Chanvriers Bretons",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.leschanvriersbretons.com",
    siteName: "Les Chanvriers Bretons",
    title: "Les Chanvriers Bretons | CBD Naturel Direct Producteur Bretagne",
    description:
      "CBD naturel direct producteur breton : fleurs de CBD, résines, huiles spectre complet, tisanes chanvre artisanales. Circuit court, sans pesticide, livraison rapide France.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Les Chanvriers Bretons – CBD naturel direct producteur en Bretagne",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Les Chanvriers Bretons | CBD Naturel Direct Producteur Bretagne",
    description:
      "Fleurs de CBD direct producteur breton, tisanes chanvre artisanales, huiles spectre complet. Achat CBD circuit court, sans pesticide. Livraison France.",
    images: ["/og-default.png"],
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
  const initialCookieConsent = parseConsentCookieValue((await cookies()).get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? "");
  return (
    <html lang="fr" nonce={nonce}>
      <head>
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
        <CartProvider>
          <CookieConsentProvider initialConsent={initialCookieConsent}>
            <SupabaseRecoveryRedirect />
            <VercelAnalytics />
            <PendingPaymentRecoveryModal />
            <div className="site-background min-h-screen">
              <Navbar />
              <main className="relative z-0">{children}</main>
              <Footer />
            </div>
            <NewProductsPopup />
          </CookieConsentProvider>
        </CartProvider>
      </body>
    </html>
  );
}
