import InsiderActivity from "@/components/quantifi/InsiderActivity";

export const metadata = {
  title: "Insider Activity · Quantifi",
  description: "Insider and promoter activity as research context — filter by type.",
};

export default function InsiderActivityPage() {
  return <InsiderActivity showFilter />;
}
