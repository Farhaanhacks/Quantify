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
//   another company's page, silently and permanently. Entries carry an ISIN
//   only where one has been supplied or read out of a filing; the rest key on a
//   provisional symbol id and are upgraded when a filing carrying an ISIN is
//   ingested. HDFC Bank's INE040A01034 is here because it was given, not
//   recalled.
//
//   Both listings are linked, always. A company files once and trades on two
//   exchanges, so linking only the NSE line leaves a reader who arrived at
//   HDFCBANK.BO looking at a card that says the data is unavailable while it
//   sits in the database under the other symbol.
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
  { companyId: "isin:INE040A01034", isin: "INE040A01034", symbols: ["HDFCBANK.NS", "HDFCBANK.BO"], legalName: "HDFC Bank Limited", rbiNames: ["HDFC Bank Ltd."] },
  { companyId: "provisional:nse:ICICIBANK", symbols: ["ICICIBANK.NS", "ICICIBANK.BO"], legalName: "ICICI Bank Limited", rbiNames: ["ICICI Bank Ltd."] },
  { companyId: "provisional:nse:KOTAKBANK", symbols: ["KOTAKBANK.NS", "KOTAKBANK.BO"], legalName: "Kotak Mahindra Bank Limited", rbiNames: ["Kotak Mahindra Bank Ltd."] },
  { companyId: "provisional:nse:AXISBANK", symbols: ["AXISBANK.NS", "AXISBANK.BO"], legalName: "Axis Bank Limited", rbiNames: ["Axis Bank Ltd."] },
  { companyId: "provisional:nse:INDUSINDBK", symbols: ["INDUSINDBK.NS", "INDUSINDBK.BO"], legalName: "IndusInd Bank Limited", rbiNames: ["IndusInd Bank Ltd."] },
  { companyId: "provisional:nse:IDFCFIRSTB", symbols: ["IDFCFIRSTB.NS", "IDFCFIRSTB.BO"], legalName: "IDFC First Bank Limited", rbiNames: ["IDFC FIRST Bank Ltd.", "IDFC Bank Ltd."] },
  { companyId: "provisional:nse:FEDERALBNK", symbols: ["FEDERALBNK.NS", "FEDERALBNK.BO"], legalName: "Federal Bank Limited", rbiNames: ["The Federal Bank Ltd."] },
  { companyId: "provisional:nse:BANDHANBNK", symbols: ["BANDHANBNK.NS", "BANDHANBNK.BO"], legalName: "Bandhan Bank Limited", rbiNames: ["Bandhan Bank Ltd."] },
  { companyId: "provisional:nse:RBLBANK", symbols: ["RBLBANK.NS", "RBLBANK.BO"], legalName: "RBL Bank Limited", rbiNames: ["RBL Bank Ltd.", "Ratnakar Bank Ltd."] },
  { companyId: "provisional:nse:YESBANK", symbols: ["YESBANK.NS", "YESBANK.BO"], legalName: "Yes Bank Limited", rbiNames: ["YES Bank Ltd."] },
  { companyId: "provisional:nse:IDBI", symbols: ["IDBI.NS", "IDBI.BO"], legalName: "IDBI Bank Limited", rbiNames: ["IDBI Bank Ltd."] },
  { companyId: "provisional:nse:CSBBANK", symbols: ["CSBBANK.NS", "CSBBANK.BO"], legalName: "CSB Bank Limited", rbiNames: ["CSB Bank Ltd.", "Catholic Syrian Bank Ltd."] },
  { companyId: "provisional:nse:DCBBANK", symbols: ["DCBBANK.NS", "DCBBANK.BO"], legalName: "DCB Bank Limited", rbiNames: ["DCB Bank Ltd.", "Development Credit Bank Ltd."] },
  { companyId: "provisional:nse:KARURVYSYA", symbols: ["KARURVYSYA.NS", "KARURVYSYA.BO"], legalName: "Karur Vysya Bank Limited", rbiNames: ["The Karur Vysya Bank Ltd."] },
  { companyId: "provisional:nse:CUB", symbols: ["CUB.NS", "CUB.BO"], legalName: "City Union Bank Limited", rbiNames: ["City Union Bank Ltd."] },
  { companyId: "provisional:nse:SOUTHBANK", symbols: ["SOUTHBANK.NS", "SOUTHBANK.BO"], legalName: "South Indian Bank Limited", rbiNames: ["The South Indian Bank Ltd."] },
  { companyId: "provisional:nse:J&KBANK", symbols: ["J&KBANK.NS", "J&KBANK.BO"], legalName: "Jammu & Kashmir Bank Limited", rbiNames: ["The Jammu & Kashmir Bank Ltd.", "Jammu and Kashmir Bank Ltd."] },
  { companyId: "provisional:nse:TMB", symbols: ["TMB.NS", "TMB.BO"], legalName: "Tamilnad Mercantile Bank Limited", rbiNames: ["Tamilnad Mercantile Bank Ltd."] },
  { companyId: "provisional:nse:KTKBANK", symbols: ["KTKBANK.NS", "KTKBANK.BO"], legalName: "Karnataka Bank Limited", rbiNames: ["The Karnataka Bank Ltd."] },
  { companyId: "provisional:nse:DHANBANK", symbols: ["DHANBANK.NS", "DHANBANK.BO"], legalName: "Dhanlaxmi Bank Limited", rbiNames: ["Dhanlaxmi Bank Ltd."] },
  { companyId: "provisional:nse:NAINITALBK", symbols: ["NAINITALBK.NS", "NAINITALBK.BO"], legalName: "Nainital Bank Limited", rbiNames: ["The Nainital Bank Ltd."] },

  // Public sector. These are the names the strict matcher exists for.
  { companyId: "provisional:nse:SBIN", symbols: ["SBIN.NS", "SBIN.BO"], legalName: "State Bank of India" },
  { companyId: "provisional:nse:BANKBARODA", symbols: ["BANKBARODA.NS", "BANKBARODA.BO"], legalName: "Bank of Baroda" },
  { companyId: "provisional:nse:PNB", symbols: ["PNB.NS", "PNB.BO"], legalName: "Punjab National Bank" },
  { companyId: "provisional:nse:CANBK", symbols: ["CANBK.NS", "CANBK.BO"], legalName: "Canara Bank" },
  { companyId: "provisional:nse:UNIONBANK", symbols: ["UNIONBANK.NS", "UNIONBANK.BO"], legalName: "Union Bank of India" },
  { companyId: "provisional:nse:BANKINDIA", symbols: ["BANKINDIA.NS", "BANKINDIA.BO"], legalName: "Bank of India" },
  { companyId: "provisional:nse:INDIANB", symbols: ["INDIANB.NS", "INDIANB.BO"], legalName: "Indian Bank" },
  { companyId: "provisional:nse:IOB", symbols: ["IOB.NS", "IOB.BO"], legalName: "Indian Overseas Bank" },
  { companyId: "provisional:nse:CENTRALBK", symbols: ["CENTRALBK.NS", "CENTRALBK.BO"], legalName: "Central Bank of India" },
  { companyId: "provisional:nse:UCOBANK", symbols: ["UCOBANK.NS", "UCOBANK.BO"], legalName: "UCO Bank" },
  { companyId: "provisional:nse:MAHABANK", symbols: ["MAHABANK.NS", "MAHABANK.BO"], legalName: "Bank of Maharashtra" },
  { companyId: "provisional:nse:PSB", symbols: ["PSB.NS", "PSB.BO"], legalName: "Punjab & Sind Bank", rbiNames: ["Punjab and Sind Bank"] },

  // Small finance banks
  { companyId: "provisional:nse:AUBANK", symbols: ["AUBANK.NS", "AUBANK.BO"], legalName: "AU Small Finance Bank Limited", rbiNames: ["AU Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:EQUITASBNK", symbols: ["EQUITASBNK.NS", "EQUITASBNK.BO"], legalName: "Equitas Small Finance Bank Limited", rbiNames: ["Equitas Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:UJJIVANSFB", symbols: ["UJJIVANSFB.NS", "UJJIVANSFB.BO"], legalName: "Ujjivan Small Finance Bank Limited", rbiNames: ["Ujjivan Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:SURYODAY", symbols: ["SURYODAY.NS", "SURYODAY.BO"], legalName: "Suryoday Small Finance Bank Limited", rbiNames: ["Suryoday Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:UTKARSHBNK", symbols: ["UTKARSHBNK.NS", "UTKARSHBNK.BO"], legalName: "Utkarsh Small Finance Bank Limited", rbiNames: ["Utkarsh Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:ESAFSFB", symbols: ["ESAFSFB.NS", "ESAFSFB.BO"], legalName: "ESAF Small Finance Bank Limited", rbiNames: ["ESAF Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:JANASFB", symbols: ["JANASFB.NS", "JANASFB.BO"], legalName: "Jana Small Finance Bank Limited", rbiNames: ["Jana Small Finance Bank Ltd."] },
  { companyId: "provisional:nse:CAPITALSFB", symbols: ["CAPITALSFB.NS", "CAPITALSFB.BO"], legalName: "Capital Small Finance Bank Limited", rbiNames: ["Capital Small Finance Bank Ltd."] },
];
