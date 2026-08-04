import type { Metadata } from "next";

export const SITE = {
  name: "Quantifi",
  url: "https://quantifiapp.com",
  tagline: "Stock Research, Portfolio Analysis & Market Theme Intelligence",
  description:
    "Quantifi helps retail investors analyse stocks, portfolio risk, valuation, market themes, news impact and investment narratives. Research only, not investment advice.",
  ogImage: "/logo.png",
  twitter: "@quantifiapp",
} as const;

// Reusable metadata builder: title, description, canonical, OG, Twitter, robots.
export function buildMetadata({
  title,
  description,
  path = "/",
  ogImage,
  noindex = false,
  type = "website",
}: {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = `${SITE.url}${path}`;
  const img = ogImage ?? SITE.ogImage;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type,
      images: [{ url: img, width: 1200, height: 630, alt: `${SITE.name} — ${title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [img],
    },
  };
}

// ── Structured data (JSON-LD) builders ──────────────────────────────────────
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    description: SITE.description,
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/stock-analysis?symbol={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: SITE.url,
    description: SITE.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE.url}${it.path}`,
    })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function articleJsonLd({
  title,
  description,
  path,
  updated,
}: {
  title: string;
  description: string;
  path: string;
  updated?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${SITE.url}${path}`,
    image: `${SITE.url}${SITE.ogImage}`,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` } },
    ...(updated ? { dateModified: updated } : {}),
    isAccessibleForFree: true,
  };
}
