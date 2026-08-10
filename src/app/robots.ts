import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const PRIVATE_PATHS = [
  "/admin/",
  "/api/",
  "/compte/",
  "/profil",
  "/age-gate",
  "/jeu",
] as const;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
      {
        // ChatGPT Search discovery is independent from GPTBot training controls.
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
