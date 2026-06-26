import LegalShell, { H2 } from "@/components/quantifi/LegalShell";

export const metadata = {
  title: "About · Quantifi",
  description:
    "Quantifi is an educational market-research and analytics platform — news impact, research ideas, screening and a personal portfolio tracker. Not a broker or adviser.",
};

export default function AboutPage() {
  return (
    <LegalShell eyebrow="About" title="About Quantifi">
      <p>
        Quantifi is an educational market-research and analytics platform. It helps people study what is
        moving in the markets, why it might matter, and how it connects to companies and themes — so they
        can do better, more structured research of their own.
      </p>

      <H2>What Quantifi does</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li><strong className="text-slate-200">News Impact</strong> — maps a news headline to the stocks it may affect, with the reasoning.</li>
        <li><strong className="text-slate-200">Research Ideas & Playbooks</strong> — curated, editorial research frameworks. Opinion and study material, not signals.</li>
        <li><strong className="text-slate-200">Stock Analysis & Screener</strong> — live charts, fundamentals and a research scorecard, computed from public market data.</li>
        <li><strong className="text-slate-200">Portfolio Tracker</strong> — you enter your own holdings; Quantifi shows value, gain/loss and concentration using live prices. Your holdings stay in your browser/account — we never connect to your broker.</li>
        <li><strong className="text-slate-200">Insider Activity</strong> — real US SEC Form 4 filings, shown for information.</li>
      </ul>

      <H2>What Quantifi is not</H2>
      <p>
        Quantifi is <strong className="text-slate-200">not a broker, not an exchange, and not a registered
        investment adviser.</strong> We do not execute trades, hold your money, or connect to your
        brokerage account. We are not affiliated with, or endorsed by, any broker, exchange, or the
        companies mentioned on the site. Market data may be delayed and is provided on a best-efforts
        basis for educational use only.
      </p>

      <H2>Data sources</H2>
      <p>
        Prices, fundamentals and charts come from public market-data sources (including Yahoo Finance and
        TradingView for charts). News comes from public news feeds. Insider data comes from the U.S. SEC
        EDGAR system. These sources are independent of Quantifi.
      </p>

      <H2>Who runs it</H2>
      <p>
        Quantifi is operated by its founder as an independent product. For any question — support,
        billing, privacy or data deletion — email{" "}
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
