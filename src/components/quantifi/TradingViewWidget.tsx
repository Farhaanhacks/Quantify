"use client";

import { useEffect, useRef } from "react";

// Official TradingView embeddable widgets — the sanctioned, free way to show
// their charts/data on your own site (no scraping). Attribution is REQUIRED by
// TradingView's terms; do not remove the copyright link below.
// Symbol helper lives in "@/lib/tvSymbol" (plain module, server-safe).

type WidgetKind = "advanced-chart" | "symbol-overview" | "symbol-info";

const SRC: Record<WidgetKind, string> = {
  "advanced-chart":
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "symbol-overview":
    "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js",
  "symbol-info":
    "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js",
};

export default function TradingViewWidget({
  symbol,
  kind = "advanced-chart",
  height = 520,
  range = "12M",
  allowSymbolChange = false,
}: {
  symbol: string;
  kind?: WidgetKind;
  height?: number;
  range?: string;
  allowSymbolChange?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = ""; // reset (also handles dev strict-mode double run)

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.appendChild(widget);

    // Required attribution — leave this in.
    const attr = document.createElement("div");
    attr.className = "tradingview-widget-copyright";
    attr.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color:#64748b;font-size:11px;text-decoration:none">Charts by TradingView</a>';
    container.appendChild(attr);

    let config: Record<string, unknown>;
    if (kind === "advanced-chart") {
      config = {
        symbol,
        autosize: true,
        theme: "dark",
        style: "1",
        range,
        hide_side_toolbar: true,
        allow_symbol_change: allowSymbolChange,
        calendar: false,
        support_host: "https://www.tradingview.com",
      };
    } else if (kind === "symbol-info") {
      config = {
        symbol,
        width: "100%",
        colorTheme: "dark",
        isTransparent: true,
        locale: "en",
      };
    } else {
      config = {
        symbols: [[symbol]],
        colorTheme: "dark",
        isTransparent: true,
        width: "100%",
        height,
        chartOnly: false,
      };
    }

    const script = document.createElement("script");
    script.src = SRC[kind];
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, kind, height, range, allowSymbolChange]);

  return (
    <div
      className="tradingview-widget-container overflow-hidden rounded-2xl border border-white/[0.08]"
      ref={ref}
      style={{ height }}
    />
  );
}
