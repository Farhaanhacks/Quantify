"use client";

import { useEffect, useRef } from "react";

// TradingView's stock heatmap — the whole market as one picture, sized by market
// cap and coloured by the day's move.
//
// This is their official embeddable widget, which is the sanctioned way to show
// this (attribution below is required by their terms — leave it in). Two config
// flags carry the behaviour that matters here:
//
//   hasSymbolTooltip  — the detail tab that follows the cursor, showing price,
//                       market cap and change for whatever you're over.
//   hasTopBar         — the index / block-size / colour / grouping controls, so
//                       a reader can switch from the S&P 500 to another index
//                       instead of being stuck with ours.
//
// The widget draws itself inside an iframe on tradingview-widget.com, which the
// app's CSP already allows (frame-src), as it does the loader on s3 (script-src).
const SRC = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";

export default function MarketHeatmap({
  dataSource = "SPX500",
  height = 620,
}: {
  /** TradingView index id: SPX500, NASDAQ100, NIFTY50, DJDJI… */
  dataSource?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = ""; // also handles dev strict-mode's double effect run

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = `${height}px`;
    container.appendChild(widget);

    const attr = document.createElement("div");
    attr.className = "tradingview-widget-copyright";
    attr.innerHTML =
      '<a href="https://www.tradingview.com/heatmap/stock/" rel="noopener nofollow" target="_blank" style="color:#64748b;font-size:11px;text-decoration:none">Stock heatmap by TradingView</a>';
    container.appendChild(attr);

    // Clicking a tile must land on OUR analysis page, not TradingView's.
    //
    // `symbolUrl` redirects the widget's symbol links. When the template
    // carries no placeholder token, TradingView appends the clicked symbol
    // itself as `?tvwidgetsymbol=NASDAQ:AAPL`, which /stock-analysis reads and
    // maps back to our ticker format. Built from window.location.origin rather
    // than the canonical site URL so this works on previews and localhost too;
    // the widget only accepts http(s) URLs and silently ignores anything else.
    const symbolUrl = `${window.location.origin}/stock-analysis`;

    const script = document.createElement("script");
    script.src = SRC;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      dataSource,
      exchanges: [],
      grouping: "sector",
      blockSize: "market_cap_basic",
      blockColor: "change",
      locale: "en",
      symbolUrl,
      colorTheme: "dark",
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [dataSource, height]);

  return (
    <div
      className="tradingview-widget-container overflow-hidden rounded-lg border border-white/[0.08]"
      ref={ref}
      style={{ minHeight: height }}
    />
  );
}
