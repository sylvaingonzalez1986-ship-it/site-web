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
      "Les Chanvriers Bretons | CBD Bio Breton, Naturel et Legal - Livraison France",
    template: "%s | Les Chanvriers Bretons",
  },
  description:
    "CBD bio Bretagne: fleurs CBD bio, resines CBD, huiles CBD spectre complet, e-liquides CBD, cosmetiques et tisanes. Shop CBD breton naturel, legal et pas cher. Livraison rapide France.",
  keywords: [
    "CBD bio",
    "CBD bio breton",
    "CBD Bretagne",
    "cbd bretagne",
    "cbd breton",
    "chanvre bretagne",
    "chanvre breton",
    "CBD pas cher",
    "boutique CBD",
    "shop CBD",
    "cbd naturel",
    "cbd legal",
    "fleur cbd",
    "fleurs cbd bio",
    "resine cbd",
    "resines cbd",
    "huile cbd",
    "huiles cbd spectre complet",
    "full spectrum cbd",
    "e-liquide cbd",
    "vape cbd",
    "cosmetique cbd",
    "tisane cbd",
    "infusion chanvre",
    "livraison cbd france",
    "cbd artisanal",
    "les chanvriers bretons",
    "fleurs CBD",
  ],
  authors: [{ name: "Les Chanvriers Bretons" }],
  creator: "Les Chanvriers Bretons",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://leschanvriersbretons.com",
    siteName: "Les Chanvriers Bretons",
    title: "Les Chanvriers Bretons | CBD Bio Breton, Naturel et Legal",
    description:
      "CBD bio Bretagne: fleurs, resines, huiles spectre complet, e-liquides, cosmetiques et tisanes. Livraison rapide en France.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Les Chanvriers Bretons - CBD Bio Breton",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Les Chanvriers Bretons | CBD Bio Breton",
    description:
      "Shop CBD bio breton: fleurs, resines, huiles spectre complet, e-liquides, cosmetiques et tisanes.",
    images: ["/og-default.png"],
  },
  alternates: {
    canonical: "https://leschanvriersbretons.com",
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
          <div className="site-background min-h-screen">
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
