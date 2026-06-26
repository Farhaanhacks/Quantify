import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/quantifi/Navbar";
import Footer from "@/components/quantifi/Footer";
import LimitedOfferPopup from "@/components/quantifi/LimitedOfferPopup";

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
  metadataBase: new URL("https://quantifiapp.com"),
  title: "Quantifi — See what's moving, why, and which stocks are affected",
  description:
    "Quantifi is an educational market-research and analytics platform — it turns market news, insider filings and portfolio risk into clear research. Not a broker or adviser, and not investment advice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <LimitedOfferPopup />
      </body>
    </html>
  );
}
