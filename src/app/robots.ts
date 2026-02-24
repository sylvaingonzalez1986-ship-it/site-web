import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/compte/", "/profil", "/age-gate"],
      },
    ],
    sitemap: "https://leschanvriersbretons.com/sitemap.xml",
  };
}
