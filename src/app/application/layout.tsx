import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Les Chanvriers Unis — App Mobile CBD Communauté & Fidélité",
  description:
    "Téléchargez Les Chanvriers Unis : l'app mobile pour commander du CBD facilement, cumuler des points fidélité et rejoindre la communauté CBD bretonne.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/application",
  },
  openGraph: {
    title: "Les Chanvriers Unis — App Mobile CBD",
    description:
      "L'app mobile pour commander du CBD, cumuler des points fidélité et rejoindre la communauté bretonne.",
    url: "https://leschanvriersbretons.com/application",
  },
};

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
