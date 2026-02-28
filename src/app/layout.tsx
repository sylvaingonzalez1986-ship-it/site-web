import type { Metadata, Viewport } from "next";
import { Caveat, Shrikhand, Space_Grotesk } from "next/font/google";
import { AgeGateModal } from "@/components/AgeGateModal";
import { Footer } from "@/components/Footer";
import {
  LocalBusinessJsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/JsonLd";
import { Navbar } from "@/components/Navbar";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Shrikhand({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const handwrittenFont = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://leschanvriersbretons.com"),
  title: {
    default:
      "Les Chanvriers Bretons | CBD Bio Breton Naturel et Légal - Livraison France",
    template: "%s | Les Chanvriers Bretons",
  },
  description:
    "CBD bio Bretagne : fleurs CBD, résines, huiles spectre complet, e-liquides, cosmétiques et tisanes au chanvre breton. Shop CBD artisanal, naturel et légal. Producteurs bretons, livraison rapide France.",
  keywords: [
    "CBD bio",
    "CBD bio breton",
    "CBD Bretagne",
    "cbd bretagne",
    "cbd breton",
    "chanvre bretagne",
    "chanvre breton",
    "chanvrier breton",
    "CBD pas cher",
    "boutique CBD",
    "shop CBD",
    "cbd naturel",
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
    "vape cbd",
    "cosmétique cbd",
    "tisane cbd",
    "infusion chanvre",
    "livraison cbd france",
    "cbd artisanal",
    "les chanvriers bretons",
    "fleurs CBD",
    "CBD Finistère",
    "CBD Côtes d'Armor",
    "CBD Morbihan",
    "CBD Ille-et-Vilaine",
    "CBD Rennes",
    "CBD Brest",
    "CBD Quimper",
    "producteur cbd breton",
    "chanvre bio breton",
  ],
  authors: [{ name: "Les Chanvriers Bretons" }],
  creator: "Les Chanvriers Bretons",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://leschanvriersbretons.com",
    siteName: "Les Chanvriers Bretons",
    title: "Les Chanvriers Bretons | CBD Bio Breton, Naturel et Légal",
    description:
      "CBD bio Bretagne : fleurs, résines, huiles spectre complet, e-liquides, cosmétiques et tisanes. Producteurs bretons, livraison rapide en France.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Les Chanvriers Bretons - CBD Bio Breton Naturel et Légal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Les Chanvriers Bretons | CBD Bio Breton Naturel et Légal",
    description:
      "Shop CBD bio breton : fleurs, résines, huiles spectre complet, e-liquides, cosmétiques et tisanes. Livraison France.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${handwrittenFont.variable} bg-mint text-ink antialiased`}
      >
        <AgeGateModal />
        <OrganizationJsonLd />
        <LocalBusinessJsonLd />
        <WebSiteJsonLd />
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
