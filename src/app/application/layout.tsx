import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Les Chanvriers Unis — App Mobile CBD Bretagne, Communauté & Fidélité",
  description:
    "Téléchargez Les Chanvriers Unis : l'app mobile pour commander du CBD bio breton, cumuler des points fidélité, suivre les producteurs bretons et rejoindre la communauté CBD en Bretagne.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/application",
  },
  openGraph: {
    title: "Les Chanvriers Unis — App Mobile CBD Bretagne",
    description:
      "L'app mobile pour commander du CBD bio breton, cumuler des points fidélité et rejoindre la communauté des chanvriers bretons.",
    url: "https://leschanvriersbretons.com/application",
  },
};

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
