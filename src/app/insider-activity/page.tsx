import InsiderActivity from "@/components/quantifi/InsiderActivity";
import CongressTrades from "@/components/quantifi/CongressTrades";
import ProGate from "@/components/quantifi/ProGate";

// Access depends on the signed-in user's subscription, so render per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insider Activity · Quantifi",
  description: "Corporate insider (SEC Form 4) and U.S. congressional (STOCK Act) trading as research context.",
};

export default function InsiderActivityPage() {
  return (
    <ProGate feature="Insider Activity">
      <InsiderActivity showFilter />
      <CongressTrades />
    </ProGate>
  );
}
