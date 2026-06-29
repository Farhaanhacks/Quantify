import UndervaluedFinds from "@/components/quantifi/UndervaluedFinds";
import RareFinds from "@/components/quantifi/RareFinds";
import ProGate from "@/components/quantifi/ProGate";

// Access depends on the signed-in user's subscription, so render per request.
export const dynamic = "force-dynamic";

// Pro-gated content → keep out of the index (crawlers see the upsell, not the data).
export const metadata = {
  title: "Rare Finds",
  description: "A live scan ranking names by analyst upside, plus undervalued high-potential ideas.",
  robots: { index: false, follow: false },
};

export default function RareFindsPage() {
  return (
    <ProGate feature="Rare Finds">
      <UndervaluedFinds />
      <RareFinds />
    </ProGate>
  );
}
