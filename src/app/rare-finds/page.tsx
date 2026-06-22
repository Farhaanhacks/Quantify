import UndervaluedFinds from "@/components/quantifi/UndervaluedFinds";
import RareFinds from "@/components/quantifi/RareFinds";
import ProGate from "@/components/quantifi/ProGate";

// Access depends on the signed-in user's subscription, so render per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rare Finds · Quantifi",
  description: "A live scan ranking names by analyst upside, plus undervalued high-potential ideas and 2–3 year plans built around the AI-bubble debate.",
};

export default function RareFindsPage() {
  return (
    <ProGate feature="Rare Finds">
      <UndervaluedFinds />
      <RareFinds />
    </ProGate>
  );
}
