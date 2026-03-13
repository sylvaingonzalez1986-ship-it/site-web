import type { Metadata, Viewport } from "next";
import { Caveat, Shrikhand, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import {
  LocalBusinessJsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/JsonLd";
import { LocalAnalyticsTracker } from "@/components/LocalAnalyticsTracker";
import { Navbar } from "@/components/Navbar";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { WebVitals } from "@/components/WebVitals";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const displayFont = Shrikhand({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const handwrittenFont = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  fallback: ["cursive", "Comic Sans MS"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://leschanvriersbretons.com"),
  icons: {
    icon: [
      { url: "/app-character-cropped.png", type: "image/png", sizes: "192x192" },
      { url: "/app-character-cropped.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/app-character-cropped.png", type: "image/png", sizes: "180x180" }],
    shortcut: ["/app-character-cropped.png"],
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
    url: "https://leschanvriersbretons.com",
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
    canonical: "https://leschanvriersbretons.com",
    languages: {
      "fr-FR": "https://leschanvriersbretons.com",
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
        <LocalBusinessJsonLd />
        <WebSiteJsonLd />
        <Suspense fallback={null}>
          <LocalAnalyticsTracker />
        </Suspense>
        <WebVitals />
        <CartProvider>
          <TutorialProvider>
            <div className="site-background min-h-screen">
              <Navbar />
              <main>{children}</main>
              <Footer />
            </div>
          </TutorialProvider>
        </CartProvider>
      </body>
    </html>
  );
}
