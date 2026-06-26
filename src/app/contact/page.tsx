import LegalShell, { H2 } from "@/components/quantifi/LegalShell";

export const metadata = {
  title: "Contact · Quantifi",
  description: "Get in touch with Quantifi — support, billing, privacy and data-deletion requests.",
};

export default function ContactPage() {
  return (
    <LegalShell eyebrow="Contact" title="Contact us">
      <p>
        We&apos;re a small, independent product and we read every message. The fastest way to reach us is
        by email.
      </p>

      <H2>Email</H2>
      <p>
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>
        <br />
        We aim to reply within 2–3 business days.
      </p>

      <H2>What to contact us about</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Help using Quantifi or reporting a problem</li>
        <li>Billing, subscription or cancellation questions (Quantifi Pro)</li>
        <li>Privacy questions or a request to delete your data</li>
        <li>Reporting anything that looks wrong, misleading or unsafe</li>
      </ul>

      <p className="text-slate-400">
        Quantifi never asks for your broker login, bank password, card PIN or OTP. All payments are
        handled on Razorpay&apos;s secure checkout — we will never ask you to send card or UPI details by
        email or message.
      </p>
    </LegalShell>
  );
}
