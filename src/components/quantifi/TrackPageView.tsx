"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// One beacon per page view, including the pages nobody is signed in for —
// which is the half of the funnel that was previously invisible.
//
// Deliberately tiny: no third-party script, no identifiers beyond the
// first-party cookie the endpoint sets, and it never blocks rendering. If the
// request fails the page does not notice.
export default function TrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // A stock page is worth counting as a stock view as well as a visit, since
    // "which companies are people actually opening" is the question the ticker
    // table on /admin answers.
    const m = pathname.match(/^\/stocks\/([^/]+)/);
    const payload = JSON.stringify({
      kind: m ? "stock" : "visit",
      path: pathname,
      ticker: m ? decodeURIComponent(m[1]) : undefined,
    });
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
