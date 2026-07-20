// Indian insider / SAST disclosures from BSE's official corporate-filings feed.
//
// Unlike US SEC Form 4 (clean per-transaction XML), Indian promoter/director
// "insider trading" disclosures under SEBI (PIT) Regulation 7 are published by
// BSE as filing ANNOUNCEMENTS — a headline, a category and the official filing
// PDF. So that's exactly what we surface: real, source-linked disclosures, with
// a link to the BSE PDF — NOT fabricated share/price columns (which would need
// us to parse the PDFs and guess). Everything is wrapped defensively: any
// failure (BSE blocking our IP, endpoint drift, a timeout) yields an empty list
// and the UI shows an honest "not available", never invented data.
//
// NOTE: BSE actively rate-limits/blocks non-browser and datacenter IPs, so this
// can be intermittent from a serverless host. That's expected and handled — a
// blocked request simply reads as "no disclosures available right now".

export interface IndiaDisclosure {
  id: string;
  ticker: string;
  company: string;
  headline: string;
  category: string;
  date: string; // YYYY-MM-DD
  url?: string; // official BSE filing PDF
}

const BSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.bseindia.com/",
  Origin: "https://www.bseindia.com",
};

// Stable BSE scrip codes for common large-caps, so the most-searched names work
// even when BSE's search endpoint blocks our IP. These are public, fixed
// identifiers (not data we compute), keyed by the NSE/base symbol.
const BSE_SCRIP: Record<string, string> = {
  RELIANCE: "500325", TCS: "532540", HDFCBANK: "500180", INFY: "500209",
  ICICIBANK: "532174", HINDUNILVR: "500696", SBIN: "500112", BHARTIARTL: "532454",
  ITC: "500875", KOTAKBANK: "500247", LT: "500510", BAJFINANCE: "500034",
  AXISBANK: "532215", ASIANPAINT: "500820", MARUTI: "532500", HCLTECH: "532281",
  SUNPHARMA: "524715", TITAN: "500114", WIPRO: "507685", ULTRACEMCO: "532538",
  NESTLEIND: "500790", TATAMOTORS: "500570", TATASTEEL: "500470", POWERGRID: "532898",
  NTPC: "532555", ADANIENT: "512599", ADANIPORTS: "532921", ONGC: "500312",
  COALINDIA: "533278", TECHM: "532755", MRF: "500290", BAJAJFINSV: "532978",
  ZOMATO: "543320", PAYTM: "543396", DMART: "540376", IRCTC: "542830",
  VEDL: "500295", DLF: "532868", SBICARD: "543066", "M&M": "500520",
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const asStr = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
const pick = (o: Rec, ...keys: string[]): string => {
  for (const k of keys) {
    const v = asStr(o[k]).trim();
    if (v) return v;
  }
  return "";
};

async function fetchJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: BSE_HEADERS,
      signal: ctrl.signal,
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const baseSymbol = (ticker: string): string =>
  ticker.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();

async function resolveScripCode(ticker: string): Promise<string | null> {
  const sym = baseSymbol(ticker);
  // A ".BO" ticker is sometimes already the numeric BSE scrip code.
  if (/^\d{6}$/.test(sym)) return sym;
  if (BSE_SCRIP[sym]) return BSE_SCRIP[sym];

  // Fall back to BSE's search endpoint.
  const data = await fetchJson(
    `https://api.bseindia.com/BseIndiaAPI/api/PageInoutSearch/w?flag=&text=${encodeURIComponent(sym)}`
  );
  const arr: unknown[] = Array.isArray(data)
    ? data
    : isRec(data) && Array.isArray(data.Table)
    ? (data.Table as unknown[])
    : [];
  for (const row of arr) {
    if (!isRec(row)) continue;
    const code = pick(row, "scrip_cd", "SCRIP_CD", "Scrip_Cd", "scripcode", "SCRIPCD");
    if (/^\d{5,6}$/.test(code)) return code;
  }
  return null;
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export async function getIndiaInsiderDisclosures(
  ticker: string,
  limit = 15
): Promise<IndiaDisclosure[]> {
  try {
    const scrip = await resolveScripCode(ticker);
    if (!scrip) return [];

    const to = new Date();
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const url =
      `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
      `&strPrevDate=${ymd(from)}&strScrip=${scrip}&strSearch=P&strToDate=${ymd(to)}&strType=C`;
    const data = await fetchJson(url);
    const rows: unknown[] =
      isRec(data) && Array.isArray(data.Table) ? (data.Table as unknown[]) : [];

    const out: IndiaDisclosure[] = [];
    for (const r of rows) {
      if (!isRec(r)) continue;
      const cat = pick(r, "CATEGORYNAME", "Category", "NEWSCATEGORYNAME");
      const sub = pick(r, "NEWSSUB", "HEADLINE", "NEWS_SUB", "Headline");
      const hay = `${cat} ${sub}`.toLowerCase();
      // Keep only the insider-trading / SAST disclosures.
      if (!/insider|sast|reg(\.|ulation)?\s*7|prohibition of insider|pit\b/.test(hay)) continue;

      const dtRaw = pick(r, "NEWS_DT", "News_submission_dt", "DT_TM", "News_Dt");
      const t = Date.parse(dtRaw);
      const date = isFinite(t) ? new Date(t).toISOString().slice(0, 10) : dtRaw.slice(0, 10);
      const att = pick(r, "ATTACHMENTNAME", "Attachment", "ATTACHMENT");
      const company = pick(r, "SLONGNAME", "Sname", "SNAME") || baseSymbol(ticker);

      out.push({
        id: pick(r, "NEWSID", "NEWS_ID") || `${scrip}-${out.length}`,
        ticker: ticker.toUpperCase(),
        company,
        headline: sub || cat || "Insider / SAST disclosure",
        category: cat || "Insider Trading / SAST",
        date,
        url: att
          ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${att}`
          : undefined,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
