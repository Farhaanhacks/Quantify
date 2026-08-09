import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private / transactional / auth surfaces are kept out of the index.
        disallow: [
          "/api/",
          "/portfolio",
          "/watchlist",
          "/billing",
          "/insider-activity",
          "/notes",
          "/account",
          "/settings",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
