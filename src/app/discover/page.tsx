import { redirect } from "next/navigation";

// "Discover" is the section, not a page. The top bar points here; this hands
// straight on to the first tab.
//
// The tabs keep their original URLs (/ideas, /screener) rather than moving under
// /discover/*, because those paths are in the sitemap, in saved links, and in a
// dozen internal references. Grouping them in the navigation does not require
// renaming them, and renaming them would break every one of those for nothing.
export default function DiscoverPage() {
  redirect("/screener");
}
