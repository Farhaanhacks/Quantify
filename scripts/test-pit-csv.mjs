import fs from "fs";

// Pull the parser out of the ingest script so it can be tested without the
// script's env checks or its main().
const src = fs.readFileSync(new URL("./ingest-insider-in.mjs", import.meta.url), "utf8");
const start = src.indexOf("/** Split CSV text into rows");
const end = src.indexOf("/**\n * Every symbol listed on NSE");
const mod = src.slice(start, end) + "\nexport { parsePitCsv, mapCsvHeader, csvRows };";
const tmp = new URL("./_pit-parser.tmp.mjs", import.meta.url);
fs.writeFileSync(tmp, mod);
const { parsePitCsv } = await import(tmp.href);
fs.unlinkSync(tmp);

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// ── 1. The API's csv=true layout — the one the last run actually got.
// Header order taken verbatim from the workflow log's body preview.
const API_HEADER =
  '"SYMBOL ","COMPANY ","REGULATION ","NAME OF THE ACQUIRER/DISPOSER ","CATEGORY OF PERSON ",' +
  '"TYPE OF SECURITY (PRIOR) ","NO. OF SECURITY (PRIOR) ","% SHAREHOLDING (PRIOR) ",' +
  '"TYPE OF SECURITY (ACQUIRED/DISPLOSED) ","NO. OF SECURITIES (ACQUIRED/DISPLOSED) ",' +
  '"VALUE OF SECURITY (ACQUIRED/DISPLOSED) ","ACQUISITION/DISPOSAL TRANSACTION TYPE ",' +
  '"TYPE OF SECURITY (POST) ","NO. OF SECURITY (POST) ","% POST ",' +
  '"DATE OF ALLOTMENT/ACQUISITION FROM ","DATE OF ALLOTMENT/ACQUISITION TO ",' +
  '"DATE OF INTIMATION TO COMPANY ","MODE OF ACQUISITION ","EXCHANGE "';

const apiCsv =
  API_HEADER + "\n" +
  '"LENSKART","Lenskart Solutions Limited","Reg 7(2) - Continual Disclosure","Peyush Bansal",' +
  '"Promoters","Equity Shares","1200000","3.5","Equity Shares","150000","21400000","Sell",' +
  '"Equity Shares","1050000","3.1","04-Aug-2026","04-Aug-2026","05-Aug-2026","Market Sale","NSE"\n' +
  '"LENSKART","Lenskart Solutions Limited","Reg 7(2) - Continual Disclosure","Neha Bansal",' +
  '"Immediate Relative","Equity Shares","50000","0.1","Equity Shares","8,250","1180000","Buy",' +
  '"Equity Shares","58250","0.2","29-Jul-2026","29-Jul-2026","30-Jul-2026","Market Purchase","NSE"\n';

const api = parsePitCsv(apiCsv, "LENSKART");
console.log("\n[API csv=true layout]");
check("parses 2 rows (header not counted)", api.length === 2, `got ${api.length}`);
check("person is the acquirer, not the company", api[0]?.acqName === "Peyush Bansal", api[0]?.acqName);
check("company is the company", api[0]?.company === "Lenskart Solutions Limited", api[0]?.company);
check("role is the category of person", api[0]?.personCategory === "Promoters", api[0]?.personCategory);
check("side comes from the transaction type", api[0]?.tdpTransactionType === "Sell", api[0]?.tdpTransactionType);
check("shares is the acquired/disposed quantity", api[0]?.secAcq === "150000", api[0]?.secAcq);
check("value is the transaction value", api[0]?.secVal === "21400000", api[0]?.secVal);
check("date is the allotment-from date", api[0]?.date === "04-Aug-2026", api[0]?.date);
check("symbol taken from the row", api[0]?.symbol === "LENSKART", api[0]?.symbol);
check("comma-separated quantity parsed", api[1]?.secAcq === "8250", api[1]?.secAcq);
check("second row side is Buy", api[1]?.tdpTransactionType === "Buy", api[1]?.tdpTransactionType);

// ── 2. The website download layout — no leading SYMBOL column, different names.
const siteCsv =
  '"COMPANY","NAME OF PERSON","CATEGORY OF PERSON","TYPE OF SECURITY (ACQUIRED/DISPLOSED)",' +
  '"NO. OF SECURITIES (ACQUIRED/DISPLOSED)","VALUE OF SECURITY (ACQUIRED/DISPLOSED)",' +
  '"TRANSACTION TYPE","DATE OF ALLOTMENT/ACQUISITION FROM"\n' +
  '"Reliance Industries Limited","Kokilaben Ambani","Promoter Group","Equity Shares",' +
  '"150000","21400000","Sell","04-Aug-2026"\n';
const site = parsePitCsv(siteCsv, "RELIANCE");
console.log("\n[website download layout]");
check("parses 1 row", site.length === 1, `got ${site.length}`);
check("person correct", site[0]?.acqName === "Kokilaben Ambani", site[0]?.acqName);
check("role correct", site[0]?.personCategory === "Promoter Group", site[0]?.personCategory);
check("shares correct", site[0]?.secAcq === "150000", site[0]?.secAcq);
check("falls back to the passed symbol when absent", site[0]?.symbol === "RELIANCE", site[0]?.symbol);

// ── 3. Header-only response — what LENSKART actually returned last run.
console.log("\n[header-only response]");
const headerOnly = parsePitCsv(API_HEADER + "\n", "LENSKART");
check("yields 0 rows, not 1", headerOnly.length === 0, `got ${headerOnly.length}`);

// ── 4. Garbage / unknown layout must not be guessed at.
console.log("\n[unrecognised layout]");
check("no header match → 0 rows", parsePitCsv('"a","b","c"\n"1","2","3"\n', "X").length === 0);
check("empty body → 0 rows", parsePitCsv("", "X").length === 0);
check("block page → 0 rows", parsePitCsv("<html>Access Denied</html>", "X").length === 0);

// ── 5. Rows whose quantity is not a number are dropped.
console.log("\n[non-numeric quantity]");
const junk = API_HEADER + "\n" +
  '"X","X Ltd","Reg 7(2)","Some Person","Promoters","Equity Shares","1","1","Equity Shares",' +
  '"-","0","Sell","Equity Shares","1","1","04-Aug-2026","04-Aug-2026","05-Aug-2026","Sale","NSE"\n';
check('quantity "-" is dropped', parsePitCsv(junk, "X").length === 0, `got ${parsePitCsv(junk, "X").length}`);

// ── 6. Market-wide export: rows carry their own SYMBOL, none is passed in.
console.log("\n[market-wide export, no symbol argument]");
const wide = API_HEADER + "\n" +
  '"RELIANCE","Reliance Industries Limited","Reg 7(2)","Kokilaben Ambani","Promoter Group","Equity Shares","1","1","Equity Shares","150000","21400000","Sell","Equity Shares","1","1","04-Aug-2026","04-Aug-2026","05-Aug-2026","Market Sale","NSE"\n' +
  '"LENSKART","Lenskart Solutions Limited","Reg 7(2)","Peyush Bansal","Promoters","Equity Shares","1","1","Equity Shares","8250","1180000","Buy","Equity Shares","1","1","29-Jul-2026","29-Jul-2026","30-Jul-2026","Market Purchase","NSE"\n';
const w = parsePitCsv(wide, "");
check("parses every company in one response", w.length === 2, `got ${w.length}`);
check("first row keeps its own symbol", w[0]?.symbol === "RELIANCE", w[0]?.symbol);
check("second row keeps its own symbol", w[1]?.symbol === "LENSKART", w[1]?.symbol);
check("rows are not cross-attributed", w[1]?.acqName === "Peyush Bansal", w[1]?.acqName);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
