import type { Metadata, Viewport } from "next";
import { Caveat, Shrikhand, Space_Grotesk } from "next/font/google";
import { AgeGateModal } from "@/components/AgeGateModal";
import { Footer } from "@/components/Footer";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
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
      "Les Chanvriers Bretons | Shop CBD Bio Pas Cher - Livraison France",
    template: "%s | Les Chanvriers Bretons",
  },
  description:
    "Shop CBD bio pas cher en Bretagne. Fleurs, huiles, resines, cosmetiques et infusions CBD de qualite au meilleur prix. Livraison rapide partout en France.",
  keywords: [
    "CBD bio",
    "CBD pas cher",
    "shop CBD",
    "boutique CBD",
    "fleurs CBD",
    "huile CBD",
    "resine CBD",
    "CBD France",
    "CBD Bretagne",
    "Les Chanvriers Bretons",
  ],
  authors: [{ name: "Les Chanvriers Bretons" }],
  creator: "Les Chanvriers Bretons",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://leschanvriersbretons.com",
    siteName: "Les Chanvriers Bretons",
    title: "Les Chanvriers Bretons | Shop CBD Bio Pas Cher",
    description:
      "Shop CBD bio pas cher en Bretagne. Fleurs, huiles, resines, cosmetiques et infusions CBD de qualite au meilleur prix.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Les Chanvriers Bretons | Shop CBD Bio Pas Cher",
    description:
      "Shop CBD bio pas cher en Bretagne. Fleurs, huiles, resines et cosmetiques CBD au meilleur prix.",
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