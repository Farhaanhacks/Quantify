import InsiderActivity from "@/components/quantifi/InsiderActivity";
import ProGate from "@/components/quantifi/ProGate";

// Access depends on the signed-in user's subscription, so render per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insider Activity · Quantifi",
  description: "Insider and promoter activity as research context — filter by type.",
};

export default function InsiderActivityPage() {
  return (
    <ProGate feature="Insider Activity">
      <InsiderActivity showFilter />
    </ProGate>
  );
}
