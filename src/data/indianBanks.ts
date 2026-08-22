import type { BankMasterEntry } from "@/lib/filings/adapters/rbiBankTables";

// The listed Indian banks, and the names the RBI files them under.
//
// This list is the join between a regulator's publication and a company page.
// The RBI's tables are bank-wise and free and carry exactly the four measures a
// bank's card is missing; they identify banks by name and by nothing else. No
// ISIN, no ticker, no CIN. So the matching happens here, by name, and the names
// have to be right.
//
// Two rules held to throughout:
//
//   No ISINs are guessed. An identifier written from memory that turns out to
//   belong to another security would attach one company's bad-loan ratio to
//   another company's page, silently and permanently. The entries key on the
//   NSE symbol instead, which is what the page is reached by anyway, and a real
//   ISIN can be added later from a filing that carries one.
//
//   Aliases are listed rather than inferred. The matcher refuses anything
//   ambiguous instead of guessing, so a bank whose RBI name is not here loses
//   its data until the name is added. That is the right way round: a missing
//   row is visible in the import report, and a wrong row is not visible at all.
//
// Bank of India, Indian Bank, Central Bank of India, Union Bank of India and
// Indian Overseas Bank are the reason the matcher is strict. Their names differ
// by one or two of the commonest words in the language.

export const INDIAN_BANKS: BankMasterEntry[] = [
  // Private sector
  { companyId: "provisional:nse:HDFCBANK", symbol: "HDFCBANK.NS", legalName: "HDFC Bank Limited", rbiNames: ["HDFC Bank Ltd."] },
  { companyId: "provisional:nse:ICICIBANK", symbol: "ICICIBANK.NS", legalName: "ICICI Bank Limited", rbiNames: ["ICICI Bank Ltd."] },
  { companyId: "provisional:nse:KOTAKBANK", symbol: "KOTAKBANK.NS", legalName: "Kotak Mahindra Bank Limited", rbiNames: ["Kotak Mahindra Bank Ltd."] },
  { companyId: "provisional:nse:AXISBANK", symbol: "AXISBANK.NS", legalName: "Axis Bank Limited", rbiNames: ["Axis Bank Ltd."] },
  { companyId: "provisional:nse:INDUSINDBK", symbol: "INDUSINDBK.NS", legalName: "IndusInd Bank Limited", rbiNames: ["IndusInd Bank Ltd."] },
  { companyId: "provisional:nse:IDFCFIRSTB", symbol: "IDFCFIRSTB.NS", legalName: "IDFC First Bank Limited", rbiNames: ["IDFC FIRST Bank Ltd.", "IDFC Bank Ltd."] },
  { companyId: "provisional:nse:FEDERALBNK", symbol: "FEDERALBNK.NS", legalName: "Federal Bank Limited", rbiNames: ["The Federal Bank Ltd."] },
  { companyId: "provisional:nse:BANDHANBNK", symbol: "BANDHANBNK.NS", legalName: "Bandhan Bank Limited", rbiNames: ["Bandhan Bank Ltd."] },
  { companyId: "provisional:nse:RBLBANK", symbol: "RBLBANK.NS", legalName: "RBL Bank Limited", rbiNames: ["RBL Bank Ltd.", "Ratnakar Bank Ltd."] },
  { companyId: "provisional:nse:YESBANK", symbol: "YESBANK.NS", legalName: "Yes Bank Limited", rbiNames: ["YES Bank Ltd."] },
  { companyId: "provisional:nse:IDBI", symbol: "IDBI.NS", legalName: "IDBI Bank Limited", rbiNames: ["IDBI Bank Ltd."] },
  { companyId: "provisional:nse:CSBBANK", symbol: "CSBBANK.NS", legalName: "CSB Bank Limited", rbiNames: ["CSB Bank Ltd.", "Catholic Syrian Bank Ltd."] },
  { companyId: "provisional:nse:DCBBANK", symbol: "DCBBANK.NS", legalName: "DCB Bank Limited", rbiNames: ["DCB Bank Ltd.", "Development Credit Bank Ltd."] },
  { companyId: "provisional:nse:KARURVYSYA", symbol: "KARURVYSYA.NS", legalName: "Karur Vysya Bank Limited", rbiNames: ["The Karur Vysya Bank Ltd."] },
  { companyId: "provisional:nse:CUB", symbol: "CUB.NS", legalName: "City Union Bank Limited", rbiNames: ["City Union Bank Ltd."] },
  { companyId: "provisional:nse:SOUTHBANK", symbol: "SOUTHBANK.NS", legalName: "South Indian Bank Limited", rbiNames: ["The South Indian Bank Ltd."] },
  { companyId: "provisional:nse:J&KBANK", symbol: "J&KBANK.NS", legalName: "Jammu & Kashmir Bank Limited", rbiNames: ["The Jammu & Kashmir Bank Ltd.", "Jammu and Kashmir Bank Ltd."] },
  { companyId: "provisional:nse:TMB", symbol: "TMB.NS", legalName: "Tamilnad Mercantile Bank Limited", rbiNames: ["Tamilnad Mercantile Bank Ltd."] },
  { companyId: "provisional:nse:KTKBANK", symbol: "KTKBANK.NS", legalName: "Karnataka Bank Limited", rbiNames: ["The Karnataka Bank Ltd."] },
  { companyId: "provisional:nse:DHANBANK", symbol: "DHANBANK.NS", legalName: "Dhanlaxmi Bank Limited", rbiNames: ["Dhanlaxmi Bank Ltd."] },
  { companyId: "provisional:nse:NAINITALBK", symbol: "NAINITALBK.NS", legalName: "Nainital Bank Limited", rbiNames: ["The Nainital Bank Ltd."] },

  // Public sector. These are the names the strict matcher exists for.
  { companyId: "provisional:nse:SBIN", symbol: "SBIN.NS", legalName: "State Bank of India" },
  { companyId: "provisional:nse:BANKBARODA", symbol: "BANKBARODA.NS", legalName: "Bank of Baroda" },
  { companyId: "provisional:nse:PNB", symbol: "PNB.NS", legalName: "Punjab National Bank" },
  { companyId: "provisional:nse:CANBK", symbol: "CANBK.NS", legalName: "Canara Bank" },
  { companyId: "provisional:nse:UNIONBANK", symbol: "UNIONBANK.NS", legalName: "Union Bank of India" },
  { companyId: "provisional:nse:BANKINDIA", symbol: "BANKINDIA.NS", legalName: "Bank of India" },
  { companyId: "provisional:nse:INDIANB", symbol: "INDIANB.NS", legalName: "Indian Bank" },
  { companyId: "provisional:nse:IOB", symbol: "IOB.NS", legalName: "Indian Overseas Bank" },
  { companyId: "provisional:nse:CENTRALBK", symbol: "CENTRALBK.NS", legalName: "Central Bank of India" },
  { companyId: "provisional:nse:UCOBANK", symbol: "UCOBANK.NS", legalName: "UCO Bank" },
  { companyId: "provisional:nse:MAHABANK", symbol: "MAHABANK.NS", legalName: "Bank of Maharashtra" },
  { companyId: "provisional:nse:PSB", symbol: "PSB.NS", legalName: "Punjab & Sind Bank", rbiNames: ["Punjab and Sind Bank"] },

  // Small finance banks
  { companyId: "provisional:nse:AUBANK", symbol: "AUBANK.NS", legalName: "AU Small Finance Bank Limited", rbiNames: ["AU Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:EQUITASBNK", symbol: "EQUITASBNK.NS", legalName: "Equitas Small Finance Bank Limited", rbiNames: ["Equitas Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:UJJIVANSFB", symbol: "UJJIVANSFB.NS", legalName: "Ujjivan Small Finance Bank Limited", rbiNames: ["Ujjivan Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:SURYODAY", symbol: "SURYODAY.NS", legalName: "Suryoday Small Finance Bank Limited", rbiNames: ["Suryoday Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:UTKARSHBNK", symbol: "UTKARSHBNK.NS", legalName: "Utkarsh Small Finance Bank Limited", rbiNames: ["Utkarsh Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:ESAFSFB", symbol: "ESAFSFB.NS", legalName: "ESAF Small Finance Bank Limited", rbiNames: ["ESAF Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:JANASFB", symbol: "JANASFB.NS", legalName: "Jana Small Finance Bank Limited", rbiNames: ["Jana Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:CAPITALSFB", symbol: "CAPITALSFB.NS", legalName: "Capital Small Finance Bank Limited", rbiNames: ["Capital Small Finance Bank Ltd."] },
];
