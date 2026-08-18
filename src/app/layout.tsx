import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/quantifi/Navbar";
import MarketPulse, { MarketPulseSkeleton } from "@/components/quantifi/MarketPulse";
import TrackPageView from "@/components/quantifi/TrackPageView";
import Footer from "@/components/quantifi/Footer";
import LimitedOfferPopup from "@/components/quantifi/LimitedOfferPopup";
import JsonLd from "@/components/JsonLd";
import { SITE, organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd } from "@/lib/seo";

// Inter everywhere — body, headings and numerals. One family for the whole app,
// so nothing renders in a different typeface. Both CSS variables are bound to it
// (--font-lora → font-sans/font-mono, --font-display → font-display) rather than
// renaming every utility across the codebase.
//
// `cv05`/`cv08` give the single-storey "a"/"l" alternates that keep Inter legible
// at small sizes, and `tnum` makes every figure tabular so prices and percentages
// line up in columns.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Quantifi · Stock Research, Portfolio Analysis & Market Theme Intelligence",
    template: "%s · Quantifi",
  },
  description: SITE.description,
  applicationName: SITE.name,
  robots: { index: true, follow: true },
  // Icons are provided by the app/ file conventions (favicon.ico, icon.png,
  // apple-icon.png) so Next emits one authoritative, cache-busted set of
  // <link> tags — favicon.ico is the path Google looks for first.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: "Quantifi · Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description: SITE.description,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: "Quantifi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantifi · Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description: SITE.description,
    images: [SITE.ogImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request CSP nonce set by middleware — used to authorise our own inline
  // theme script under the strict (no 'unsafe-inline') script-src.
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        {/* Light mode is the default for first-time visitors; we only stay in
            dark mode when the user has explicitly chosen it. Applied before
            paint to avoid a flash. The choice is remembered in localStorage. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')!=='dark'){document.documentElement.classList.add('light')}}catch(e){document.documentElement.classList.add('light')}",
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()]} />
        {/* Market pulse ticker sits at the very top, right above the nav bar.
            Suspended, because it is an async server component in the ROOT
            layout: without a boundary here its quote fetch had to finish before
            a single byte of ANY page could be sent, on every navigation in the
            app. A decorative ticker should never be the thing a page is waiting
            on. The fallback reserves its exact height so nothing below it
            jumps when the real strip arrives. */}
        <Suspense fallback={<MarketPulseSkeleton />}>
          <MarketPulse />
        </Suspense>
        <Navbar />
        <TrackPageView />
        <main>{children}</main>
        <Footer />
        <LimitedOfferPopup />
        <Analytics />
      </body>
    </html>
  );
}
