import type { Metadata } from "next";
import { Lora, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/quantifi/Navbar";
import MarketPulse from "@/components/quantifi/MarketPulse";
import Footer from "@/components/quantifi/Footer";
import LimitedOfferPopup from "@/components/quantifi/LimitedOfferPopup";
import JsonLd from "@/components/JsonLd";
import { SITE, organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd } from "@/lib/seo";

// Lora everywhere for body + numbers (--font-lora → font-sans / font-mono).
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

// Headings/titles only (font-display) use Source Serif 4 — a similar serif to
// Lora but with tighter, normal word spacing, so large bold titles don't read
// spaced-out the way Lora's do.
const heading = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Quantifi — Stock Research, Portfolio Analysis & Market Theme Intelligence",
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
    title: "Quantifi — Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description: SITE.description,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: "Quantifi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantifi — Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description: SITE.description,
    images: [SITE.ogImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${lora.variable} ${heading.variable}`}>
      <head>
        {/* Light mode is the default for first-time visitors; we only stay in
            dark mode when the user has explicitly chosen it. Applied before
            paint to avoid a flash. The choice is remembered in localStorage. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')!=='dark'){document.documentElement.classList.add('light')}}catch(e){document.documentElement.classList.add('light')}",
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()]} />
        {/* Market pulse ticker sits at the very top, right above the nav bar. */}
        <MarketPulse />
        <Navbar />
        <main>{children}</main>
        <Footer />
        <LimitedOfferPopup />
        <Analytics />
      </body>
    </html>
  );
}
