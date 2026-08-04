import ToolsSuite from "@/components/quantifi/ToolsSuite";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Investor Tools — DCF, Screener, Portfolio Risk & P/E Comparison",
  description:
    "Free investor research tools from Quantifi: DCF calculator, stock screener, portfolio risk analyzer and P/E comparison. Research only, not investment advice.",
  path: "/tools",
});

export default function ToolsPage() {
  return <ToolsSuite />;
}
