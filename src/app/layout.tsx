import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/quantifi/Navbar";
import Footer from "@/components/quantifi/Footer";
import LimitedOfferPopup from "@/components/quantifi/LimitedOfferPopup";
import JsonLd from "@/components/JsonLd";
import { SITE, organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd } from "@/lib/seo";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
  icons: { icon: "/icon.png", apple: "/icon.png" },
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
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}",
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()]} />
        <Navbar />
        <main>{children}</main>
        <Footer />
        <LimitedOfferPopup />
      </body>
    </html>
  );
}
