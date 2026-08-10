import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { isPublicPath } from "@/lib/publicRoutes";
import { tradingIdeas } from "@/data/ideas";
import { playbooks } from "@/data/playbooks";
import { popularTickers } from "@/data/popularTickers";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string, priority = 0.6, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly") => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  const core: MetadataRoute.Sitemap = [
    u("/", 1.0, "daily"),
    u("/ideas", 0.9, "daily"),
    u("/news", 0.8, "hourly"),
    u("/stock-analysis", 0.8, "daily"),
    u("/screener", 0.7),
    u("/tools", 0.7),
    u("/explore", 0.6),
    u("/pricing", 0.6, "monthly"),
    u("/about", 0.4, "yearly"),
    u("/contact", 0.4, "yearly"),
    u("/privacy", 0.3, "yearly"),
    u("/terms", 0.3, "yearly"),
    u("/refund-policy", 0.3, "yearly"),
  ];

  // Theme / Ideas pages (path-based for SEO).
  const themes = tradingIdeas.map((i) => u(`/ideas/${i.id}`, 0.8, "weekly"));

  // Research playbooks (long-form research memos).
  const research = playbooks.map((p) => u(`/research/${p.id}`, 0.8, "weekly"));

  // Tool landing pages.
  const tools = [
    "dcf-calculator",
    "portfolio-risk-analyzer",
    "stock-screener",
    "pe-ratio-comparison",
  ].map((t) => u(`/tools/${t}`, 0.6, "monthly"));

  // Programmatic stock pages — one per curated, liquid ticker. Every page is
  // data-rich and rendered from live fundamentals, so this is genuine long-tail
  // coverage (quality over raw count), not thin auto-generated filler.
  const stocks = popularTickers.map((t) =>
    u(`/stocks/${encodeURIComponent(t.s)}`, 0.6, "daily")
  );

  // Only advertise what a crawler can actually open. Every entry is checked
  // against the same gate the middleware enforces, so a page that redirects to
  // sign-in never appears here. Listing one is worse than omitting it: the
  // crawler spends budget fetching a URL only to be bounced to a noindex page,
  // and a sitemap full of those is a sitemap search engines learn to distrust.
  const all = [...core, ...themes, ...research, ...tools, ...stocks];
  return all.filter((entry) => {
    const path = entry.url.replace(SITE.url, "") || "/";
    return isPublicPath(path.split("?")[0]);
  });
}
