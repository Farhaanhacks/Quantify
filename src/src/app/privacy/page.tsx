import LegalShell, { H2 } from "@/components/quantifi/LegalShell";

export const metadata = {
  title: "Privacy Policy · Quantifi",
  description: "How Quantifi collects, uses and protects your data. We never connect to your broker or see your payment card details.",
};

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Privacy" title="Privacy Policy" updated="26 June 2026">
      <p>
        This policy explains what data Quantifi collects, why, and your choices. We keep it minimal: we
        only collect what we need to run the product.
      </p>

      <H2>What we collect</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong className="text-slate-200">Account info:</strong> when you sign in with Google, we
          receive your name and email address from Google. We use it to identify your account and link
          your Pro status. We do not get your Google password.
        </li>
        <li>
          <strong className="text-slate-200">Your portfolio:</strong> any holdings you add (ticker,
          quantity, average price) are stored in your browser and in our database keyed to your account,
          so your portfolio is there when you return. You enter these yourself — we never connect to or
          import from your broker.
        </li>
        <li>
          <strong className="text-slate-200">Payment:</strong> Quantifi Pro is billed by Razorpay. Card,
          UPI, bank and mandate details are entered on Razorpay&apos;s secure checkout — <strong className="text-slate-200">Quantifi never sees or stores them.</strong> We only receive a payment/subscription
          reference so we can grant your access.
        </li>
        <li>
          <strong className="text-slate-200">A session cookie</strong> (`quantifi_session`) to keep you
          signed in. We do not use it to track you across other sites.
        </li>
      </ul>

      <H2>What we do not do</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>We do not sell your personal data.</li>
        <li>We do not connect to, or store credentials for, any brokerage or bank.</li>
        <li>We do not ask for your card PIN, OTP or banking passwords.</li>
      </ul>

      <H2>Third parties we rely on</H2>
      <p>
        Google (sign-in), Razorpay (payments), Vercel (hosting), Upstash (data storage), and public
        market-data providers (Yahoo Finance, TradingView charts, news feeds, and the U.S. SEC for
        insider filings). Each processes data under its own privacy policy.
      </p>

      <H2>Your choices</H2>
      <p>
        You can remove portfolio holdings at any time in the app, and you can sign out to clear your
        session. To delete your account data entirely, email{" "}
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>{" "}
        and we will erase it.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
