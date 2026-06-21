import UndervaluedFinds from "@/components/quantifi/UndervaluedFinds";
import RareFinds from "@/components/quantifi/RareFinds";

export const metadata = {
  title: "Rare Finds · Quantifi",
  description: "A live scan ranking names by analyst upside, plus undervalued high-potential ideas and 2–3 year plans built around the AI-bubble debate.",
};

export default function RareFindsPage() {
  return (
    <>
      <UndervaluedFinds />
      <RareFinds />
    </>
  );
}
