import { NextResponse } from "next/server";
import { getHeatmap, normaliseRegion } from "@/lib/heatmap";
import { regionLabel } from "@/data/heatmapUniverse";

// Serves the heatmap for a region so the home page can switch between US and
// India without a full navigation. The page itself renders the default region
// server-side; this only exists for the toggle.
export const revalidate = 300;

export async function GET(req: Request) {
  const region = normaliseRegion(new URL(req.url).searchParams.get("region"));
  const data = await getHeatmap(region).catch(() => null);
  if (!data) {
    return NextResponse.json(
      { region, regionLabel: regionLabel(region), tiles: [], asOf: "", live: false },
      { status: 200 }
    );
  }
  return NextResponse.json(data);
}
