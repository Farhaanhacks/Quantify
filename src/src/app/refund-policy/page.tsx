import LegalShell, { H2 } from "@/components/quantifi/LegalShell";

export const metadata = {
  title: "Refund & Cancellation Policy · Quantifi",
  description: "How to cancel Quantifi Pro and how refunds work. Cancel anytime; no further charges.",
};

export default function RefundPolicyPage() {
  return (
    <LegalShell eyebrow="Billing" title="Refund & Cancellation Policy" updated="26 June 2026">
      <p>
        Quantifi Pro is a monthly subscription (₹49/month launch price, standard ₹500/month) billed
        securely by Razorpay. This policy explains how to cancel and how refunds work.
      </p>

      <H2>Cancelling</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>You can cancel Quantifi Pro at any time — there is no lock-in.</li>
        <li>To cancel, email{" "}
          <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">farhaankuka2009@gmail.com</a>{" "}
          from your account email, and we&apos;ll cancel the subscription. (We&apos;re adding in-app
          self-serve cancellation as well.)
        </li>
        <li>Cancelling stops all future charges. Your Pro access continues until the end of the billing period you&apos;ve already paid for, then reverts to the free plan.</li>
      </ul>

      <H2>Refunds</H2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Because Pro is billed in low-cost monthly cycles, we generally do not refund a month already started.</li>
        <li>If you were charged in error, charged after cancelling, or couldn&apos;t use Pro due to a fault on our side, contact us within 7 days and we&apos;ll review and refund where fair.</li>
        <li>Approved refunds are returned to your original payment method via Razorpay, typically within 5–7 business days.</li>
      </ul>

      <H2>Failed or duplicate payments</H2>
      <p>
        If a payment fails you are not charged, and no access is granted. If you believe you were charged
        twice for the same period, email us with the Razorpay payment reference and we&apos;ll resolve it.
      </p>

      <H2>Contact</H2>
      <p>
        For any billing question, email{" "}
        <a href="mailto:farhaankuka2009@gmail.com" className="text-gold hover:underline">
          farhaankuka2009@gmail.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
