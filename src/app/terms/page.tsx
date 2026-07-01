import LegalShell, { H2 } from "@/components/quantifi/LegalShell";

export const metadata = {
  title: "Terms of Service · Quantifi",
  description: "The terms for using Quantifi — an educational research platform. Not investment advice.",
};

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Terms" title="Terms of Service" updated="26 June 2026">
      <p>
        By using Quantifi (quantifiapp.com) you agree to these terms. Please read them — especially the
        parts about education-only use and the limitation of liability.
      </p>

      <H2>1. Educational use only — not advice</H2>
      <p>
        Quantifi is an educational research and analytics tool. Everything on it is for information and
        education only and is <strong className="text-slate-200">not financial, investment, legal or tax
        advice, and not a recommendation</strong> to buy, sell or hold any security. We are not a broker,
        exchange, or registered investment adviser. You are solely responsible for your own decisions.
      </p>

      <H2>2. Market data</H2>
      <p>
        Market data, fundamentals, news and insider filings come from third-party public sources, may be
        delayed or inaccurate, and are provided on a best-efforts basis with no warranty. Always verify
        independently before acting.
      </p>

      <H2>3. Your account</H2>
      <p>
        You sign in with Google and are responsible for keeping your account secure. Don&apos;t misuse the
        service, attempt to break or overload it, scrape it at scale, or use it for anything unlawful.
      </p>

      <H2>4. Quantifi Pro subscription</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Quantifi Pro is a recurring subscription billed at ¢0.55 per month (a limited launch price; standard ₹500/month) through Razorpay.</li>
        <li>By subscribing you authorise Razorpay to charge the subscription each month until you cancel.</li>
        <li>You can cancel at any time; cancellation stops future charges. See our <a href="/refund-policy" className="text-gold hover:underline">Refund &amp; Cancellation Policy</a>.</li>
        <li>Prices and features may change with notice; changes never apply retroactively to a period you&apos;ve already paid for.</li>
      </ul>

      <H2>5. No warranty &amp; limitation of liability</H2>
      <p>
        The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent
        permitted by law, Quantifi is not liable for any trading or investment losses, or for any
        indirect or consequential damages, arising from your use of the service or reliance on any
        information shown.
      </p>

      <H2>6. Changes &amp; governing law</H2>
      <p>
        We may update these terms; continued use means you accept the update. These terms are governed by
        the laws of India.
      </p>

      <H2>7. Contact</H2>
      <p>
        Questions? Email{" "}
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
