"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ─────────────────────────────────────────────────────── */

type Sector =
  | "Technology" | "HealthCare" | "Financials" | "ConsumerDisc"
  | "CommServices" | "Industrials" | "ConsumerStaples"
  | "Energy" | "Materials" | "RealEstate" | "Utilities";

interface StockMeta {
  ticker:   string;
  name:     string;
  sector:   Sector;
  industry: string;
  base:     number;
  mktCap:   number;
  pe:       number;
  divYield: number;
  w52hi:    number;
  w52lo:    number;
}

interface StockRow extends StockMeta {
  price:  number;
  prev:   number;
  chg:    number;
  pct:    number;
  bid:    number;
  ask:    number;
  volume: number;
}

type LivePrice = { price: number; bid: number; ask: number; chg: number; pct: number; dir: 1 | -1 };

/* ── Stock Catalog ─────────────────────────────────────────────── */

const STOCKS: StockMeta[] = [
  // Technology
  { ticker:"AAPL",  name:"Apple",               sector:"Technology",      industry:"Hardware",              base:225,  mktCap:3400, pe:33,  divYield:0.0044, w52hi:260, w52lo:164 },
  { ticker:"MSFT",  name:"Microsoft",            sector:"Technology",      industry:"Software",              base:415,  mktCap:3080, pe:35,  divYield:0.0073, w52hi:468, w52lo:360 },
  { ticker:"NVDA",  name:"NVIDIA",               sector:"Technology",      industry:"Semiconductors",        base:135,  mktCap:3300, pe:57,  divYield:0.0003, w52hi:153, w52lo:47  },
  { ticker:"AVGO",  name:"Broadcom",             sector:"Technology",      industry:"Semiconductors",        base:185,  mktCap:870,  pe:28,  divYield:0.0108, w52hi:251, w52lo:114 },
  { ticker:"ORCL",  name:"Oracle",               sector:"Technology",      industry:"Software",              base:165,  mktCap:455,  pe:42,  divYield:0.0093, w52hi:198, w52lo:108 },
  { ticker:"AMD",   name:"AMD",                  sector:"Technology",      industry:"Semiconductors",        base:152,  mktCap:246,  pe:0,   divYield:0,      w52hi:228, w52lo:131 },
  { ticker:"ADBE",  name:"Adobe",                sector:"Technology",      industry:"Software",              base:495,  mktCap:218,  pe:28,  divYield:0,      w52hi:638, w52lo:433 },
  { ticker:"CRM",   name:"Salesforce",           sector:"Technology",      industry:"Software",              base:310,  mktCap:303,  pe:44,  divYield:0,      w52hi:368, w52lo:218 },
  { ticker:"INTC",  name:"Intel",                sector:"Technology",      industry:"Semiconductors",        base:22,   mktCap:95,   pe:0,   divYield:0,      w52hi:51,  w52lo:18  },
  { ticker:"QCOM",  name:"Qualcomm",             sector:"Technology",      industry:"Semiconductors",        base:168,  mktCap:182,  pe:16,  divYield:0.0197, w52hi:230, w52lo:149 },
  { ticker:"TXN",   name:"Texas Instruments",    sector:"Technology",      industry:"Semiconductors",        base:190,  mktCap:173,  pe:34,  divYield:0.0272, w52hi:220, w52lo:150 },
  { ticker:"NOW",   name:"ServiceNow",           sector:"Technology",      industry:"Software",              base:1005, mktCap:208,  pe:165, divYield:0,      w52hi:1198,w52lo:673 },
  // Health Care
  { ticker:"LLY",   name:"Eli Lilly",            sector:"HealthCare",      industry:"Pharmaceuticals",       base:820,  mktCap:780,  pe:72,  divYield:0.0057, w52hi:972, w52lo:680 },
  { ticker:"UNH",   name:"UnitedHealth",         sector:"HealthCare",      industry:"Health Insurance",      base:525,  mktCap:495,  pe:19,  divYield:0.0153, w52hi:630, w52lo:445 },
  { ticker:"JNJ",   name:"Johnson & Johnson",    sector:"HealthCare",      industry:"Pharmaceuticals",       base:155,  mktCap:372,  pe:22,  divYield:0.0316, w52hi:168, w52lo:143 },
  { ticker:"ABBV",  name:"AbbVie",               sector:"HealthCare",      industry:"Pharmaceuticals",       base:196,  mktCap:347,  pe:62,  divYield:0.0307, w52hi:214, w52lo:152 },
  { ticker:"MRK",   name:"Merck",                sector:"HealthCare",      industry:"Pharmaceuticals",       base:102,  mktCap:259,  pe:145, divYield:0.0295, w52hi:134, w52lo:97  },
  { ticker:"TMO",   name:"Thermo Fisher",        sector:"HealthCare",      industry:"Life Sciences",         base:590,  mktCap:228,  pe:32,  divYield:0.0039, w52hi:682, w52lo:498 },
  { ticker:"ABT",   name:"Abbott Labs",          sector:"HealthCare",      industry:"Medical Devices",       base:115,  mktCap:200,  pe:24,  divYield:0.0194, w52hi:130, w52lo:94  },
  { ticker:"AMGN",  name:"Amgen",                sector:"HealthCare",      industry:"Pharmaceuticals",       base:298,  mktCap:160,  pe:22,  divYield:0.0315, w52hi:342, w52lo:255 },
  { ticker:"ISRG",  name:"Intuitive Surgical",   sector:"HealthCare",      industry:"Medical Devices",       base:505,  mktCap:180,  pe:86,  divYield:0,      w52hi:582, w52lo:350 },
  { ticker:"GILD",  name:"Gilead Sciences",      sector:"HealthCare",      industry:"Pharmaceuticals",       base:112,  mktCap:140,  pe:24,  divYield:0.0322, w52hi:119, w52lo:62  },
  // Financials
  { ticker:"BRK.B", name:"Berkshire Hathaway",   sector:"Financials",      industry:"Diversified Financials",base:452,  mktCap:994,  pe:9,   divYield:0,      w52hi:498, w52lo:361 },
  { ticker:"JPM",   name:"JPMorgan Chase",       sector:"Financials",      industry:"Banks",                 base:245,  mktCap:706,  pe:12,  divYield:0.0224, w52hi:280, w52lo:183 },
  { ticker:"V",     name:"Visa",                 sector:"Financials",      industry:"Payments",              base:295,  mktCap:598,  pe:31,  divYield:0.0083, w52hi:316, w52lo:245 },
  { ticker:"MA",    name:"Mastercard",           sector:"Financials",      industry:"Payments",              base:510,  mktCap:481,  pe:35,  divYield:0.0060, w52hi:547, w52lo:431 },
  { ticker:"BAC",   name:"Bank of America",      sector:"Financials",      industry:"Banks",                 base:44,   mktCap:347,  pe:14,  divYield:0.0239, w52hi:48,  w52lo:30  },
  { ticker:"WFC",   name:"Wells Fargo",          sector:"Financials",      industry:"Banks",                 base:78,   mktCap:285,  pe:14,  divYield:0.0200, w52hi:84,  w52lo:51  },
  { ticker:"GS",    name:"Goldman Sachs",        sector:"Financials",      industry:"Capital Markets",       base:565,  mktCap:194,  pe:12,  divYield:0.0218, w52hi:656, w52lo:398 },
  { ticker:"MS",    name:"Morgan Stanley",       sector:"Financials",      industry:"Capital Markets",       base:123,  mktCap:205,  pe:17,  divYield:0.0285, w52hi:135, w52lo:81  },
  { ticker:"AXP",   name:"American Express",     sector:"Financials",      industry:"Payments",              base:285,  mktCap:207,  pe:20,  divYield:0.0102, w52hi:323, w52lo:196 },
  { ticker:"BLK",   name:"BlackRock",            sector:"Financials",      industry:"Asset Management",      base:1145, mktCap:181,  pe:24,  divYield:0.0228, w52hi:1282,w52lo:763 },
  // Consumer Discretionary
  { ticker:"AMZN",  name:"Amazon",               sector:"ConsumerDisc",    industry:"E-Commerce",            base:215,  mktCap:2265, pe:44,  divYield:0,      w52hi:242, w52lo:153 },
  { ticker:"TSLA",  name:"Tesla",                sector:"ConsumerDisc",    industry:"Automobiles",           base:248,  mktCap:790,  pe:95,  divYield:0,      w52hi:480, w52lo:138 },
  { ticker:"HD",    name:"Home Depot",           sector:"ConsumerDisc",    industry:"Home Improvement",      base:415,  mktCap:412,  pe:24,  divYield:0.0233, w52hi:440, w52lo:310 },
  { ticker:"MCD",   name:"McDonald's",           sector:"ConsumerDisc",    industry:"Restaurants",           base:295,  mktCap:212,  pe:23,  divYield:0.0242, w52hi:318, w52lo:248 },
  { ticker:"NKE",   name:"Nike",                 sector:"ConsumerDisc",    industry:"Apparel",               base:73,   mktCap:110,  pe:24,  divYield:0.0198, w52hi:110, w52lo:70  },
  { ticker:"LOW",   name:"Lowe's",               sector:"ConsumerDisc",    industry:"Home Improvement",      base:245,  mktCap:147,  pe:19,  divYield:0.0214, w52hi:278, w52lo:202 },
  { ticker:"SBUX",  name:"Starbucks",            sector:"ConsumerDisc",    industry:"Restaurants",           base:85,   mktCap:95,   pe:26,  divYield:0.0301, w52hi:118, w52lo:71  },
  { ticker:"TJX",   name:"TJX Companies",        sector:"ConsumerDisc",    industry:"Specialty Retail",      base:123,  mktCap:144,  pe:26,  divYield:0.0143, w52hi:130, w52lo:88  },
  { ticker:"BKNG",  name:"Booking Holdings",     sector:"ConsumerDisc",    industry:"Travel & Leisure",      base:4850, mktCap:118,  pe:25,  divYield:0,      w52hi:5268,w52lo:3337},
  // Communication Services
  { ticker:"GOOGL", name:"Alphabet",             sector:"CommServices",    industry:"Internet & Search",     base:195,  mktCap:2420, pe:22,  divYield:0.0048, w52hi:208, w52lo:130 },
  { ticker:"META",  name:"Meta Platforms",       sector:"CommServices",    industry:"Social Media",          base:575,  mktCap:1470, pe:29,  divYield:0.0033, w52hi:740, w52lo:393 },
  { ticker:"NFLX",  name:"Netflix",              sector:"CommServices",    industry:"Streaming",             base:995,  mktCap:428,  pe:48,  divYield:0,      w52hi:1065,w52lo:542 },
  { ticker:"DIS",   name:"Disney",               sector:"CommServices",    industry:"Media & Entertainment", base:112,  mktCap:205,  pe:36,  divYield:0,      w52hi:125, w52lo:83  },
  { ticker:"TMUS",  name:"T-Mobile US",          sector:"CommServices",    industry:"Telecom",               base:225,  mktCap:262,  pe:23,  divYield:0.0151, w52hi:249, w52lo:153 },
  { ticker:"VZ",    name:"Verizon",              sector:"CommServices",    industry:"Telecom",               base:42,   mktCap:176,  pe:16,  divYield:0.0629, w52hi:46,  w52lo:37  },
  { ticker:"T",     name:"AT&T",                 sector:"CommServices",    industry:"Telecom",               base:22,   mktCap:157,  pe:17,  divYield:0.0526, w52hi:25,  w52lo:15  },
  { ticker:"CMCSA", name:"Comcast",              sector:"CommServices",    industry:"Media & Entertainment", base:38,   mktCap:144,  pe:11,  divYield:0.0310, w52hi:47,  w52lo:36  },
  // Industrials
  { ticker:"GE",    name:"GE Aerospace",         sector:"Industrials",     industry:"Aerospace & Defense",   base:195,  mktCap:213,  pe:34,  divYield:0.0069, w52hi:222, w52lo:132 },
  { ticker:"CAT",   name:"Caterpillar",          sector:"Industrials",     industry:"Industrial Machinery",  base:395,  mktCap:200,  pe:17,  divYield:0.0138, w52hi:418, w52lo:316 },
  { ticker:"RTX",   name:"RTX Corp",             sector:"Industrials",     industry:"Aerospace & Defense",   base:130,  mktCap:175,  pe:38,  divYield:0.0207, w52hi:140, w52lo:88  },
  { ticker:"HON",   name:"Honeywell",            sector:"Industrials",     industry:"Industrial Conglom.",   base:212,  mktCap:132,  pe:23,  divYield:0.0228, w52hi:229, w52lo:185 },
  { ticker:"UNP",   name:"Union Pacific",        sector:"Industrials",     industry:"Rail Transport",        base:248,  mktCap:155,  pe:21,  divYield:0.0237, w52hi:264, w52lo:209 },
  { ticker:"ETN",   name:"Eaton",                sector:"Industrials",     industry:"Electrical Equipment",  base:345,  mktCap:137,  pe:29,  divYield:0.0104, w52hi:380, w52lo:261 },
  { ticker:"LMT",   name:"Lockheed Martin",      sector:"Industrials",     industry:"Aerospace & Defense",   base:565,  mktCap:136,  pe:18,  divYield:0.0274, w52hi:620, w52lo:412 },
  { ticker:"DE",    name:"Deere & Co",           sector:"Industrials",     industry:"Industrial Machinery",  base:395,  mktCap:115,  pe:13,  divYield:0.0140, w52hi:472, w52lo:356 },
  { ticker:"UPS",   name:"UPS",                  sector:"Industrials",     industry:"Air Freight",           base:115,  mktCap:98,   pe:20,  divYield:0.0549, w52hi:160, w52lo:108 },
  { ticker:"FDX",   name:"FedEx",                sector:"Industrials",     industry:"Air Freight",           base:278,  mktCap:68,   pe:14,  divYield:0.0220, w52hi:325, w52lo:220 },
  // Consumer Staples
  { ticker:"WMT",   name:"Walmart",              sector:"ConsumerStaples", industry:"Food Retail",           base:98,   mktCap:789,  pe:37,  divYield:0.0096, w52hi:105, w52lo:60  },
  { ticker:"COST",  name:"Costco",               sector:"ConsumerStaples", industry:"Food Retail",           base:982,  mktCap:436,  pe:54,  divYield:0.0056, w52hi:1078,w52lo:694 },
  { ticker:"PG",    name:"Procter & Gamble",     sector:"ConsumerStaples", industry:"Household Products",    base:165,  mktCap:388,  pe:24,  divYield:0.0240, w52hi:178, w52lo:144 },
  { ticker:"KO",    name:"Coca-Cola",            sector:"ConsumerStaples", industry:"Beverages",             base:68,   mktCap:293,  pe:26,  divYield:0.0309, w52hi:74,  w52lo:56  },
  { ticker:"PEP",   name:"PepsiCo",              sector:"ConsumerStaples", industry:"Beverages",             base:152,  mktCap:207,  pe:21,  divYield:0.0371, w52hi:183, w52lo:145 },
  { ticker:"PM",    name:"Philip Morris",        sector:"ConsumerStaples", industry:"Tobacco",               base:135,  mktCap:135,  pe:21,  divYield:0.0425, w52hi:138, w52lo:85  },
  { ticker:"MO",    name:"Altria Group",         sector:"ConsumerStaples", industry:"Tobacco",               base:55,   mktCap:95,   pe:10,  divYield:0.0784, w52hi:57,  w52lo:40  },
  { ticker:"CL",    name:"Colgate-Palmolive",    sector:"ConsumerStaples", industry:"Household Products",    base:95,   mktCap:126,  pe:27,  divYield:0.0220, w52hi:105, w52lo:82  },
  { ticker:"KR",    name:"Kroger",               sector:"ConsumerStaples", industry:"Food Retail",           base:68,   mktCap:55,   pe:16,  divYield:0.0225, w52hi:72,  w52lo:49  },
  // Energy
  { ticker:"XOM",   name:"Exxon Mobil",          sector:"Energy",          industry:"Integrated Oil & Gas",  base:118,  mktCap:467,  pe:14,  divYield:0.0339, w52hi:126, w52lo:98  },
  { ticker:"CVX",   name:"Chevron",              sector:"Energy",          industry:"Integrated Oil & Gas",  base:155,  mktCap:283,  pe:16,  divYield:0.0434, w52hi:168, w52lo:135 },
  { ticker:"COP",   name:"ConocoPhillips",       sector:"Energy",          industry:"Oil & Gas E&P",         base:112,  mktCap:135,  pe:11,  divYield:0.0222, w52hi:129, w52lo:103 },
  { ticker:"SLB",   name:"SLB",                  sector:"Energy",          industry:"Oilfield Services",     base:42,   mktCap:60,   pe:13,  divYield:0.0286, w52hi:56,  w52lo:38  },
  { ticker:"EOG",   name:"EOG Resources",        sector:"Energy",          industry:"Oil & Gas E&P",         base:125,  mktCap:75,   pe:11,  divYield:0.0290, w52hi:140, w52lo:110 },
  { ticker:"MPC",   name:"Marathon Petroleum",   sector:"Energy",          industry:"Oil & Gas Refining",    base:182,  mktCap:61,   pe:9,   divYield:0.0196, w52hi:228, w52lo:155 },
  { ticker:"VLO",   name:"Valero Energy",        sector:"Energy",          industry:"Oil & Gas Refining",    base:155,  mktCap:49,   pe:9,   divYield:0.0326, w52hi:185, w52lo:130 },
  { ticker:"OXY",   name:"Occidental",           sector:"Energy",          industry:"Oil & Gas E&P",         base:52,   mktCap:49,   pe:13,  divYield:0.0177, w52hi:72,  w52lo:43  },
  { ticker:"HAL",   name:"Halliburton",          sector:"Energy",          industry:"Oilfield Services",     base:28,   mktCap:25,   pe:10,  divYield:0.0214, w52hi:43,  w52lo:25  },
  // Materials
  { ticker:"LIN",   name:"Linde",                sector:"Materials",       industry:"Industrial Gases",      base:478,  mktCap:227,  pe:29,  divYield:0.0130, w52hi:496, w52lo:404 },
  { ticker:"SHW",   name:"Sherwin-Williams",     sector:"Materials",       industry:"Specialty Chemicals",   base:355,  mktCap:90,   pe:28,  divYield:0.0098, w52hi:394, w52lo:282 },
  { ticker:"FCX",   name:"Freeport-McMoRan",     sector:"Materials",       industry:"Copper Mining",         base:45,   mktCap:65,   pe:19,  divYield:0.0178, w52hi:55,  w52lo:37  },
  { ticker:"NEM",   name:"Newmont",              sector:"Materials",       industry:"Gold Mining",           base:48,   mktCap:54,   pe:20,  divYield:0.0208, w52hi:58,  w52lo:30  },
  { ticker:"APD",   name:"Air Products",         sector:"Materials",       industry:"Industrial Gases",      base:295,  mktCap:66,   pe:22,  divYield:0.0282, w52hi:331, w52lo:216 },
  { ticker:"ECL",   name:"Ecolab",               sector:"Materials",       industry:"Specialty Chemicals",   base:255,  mktCap:73,   pe:38,  divYield:0.0106, w52hi:265, w52lo:186 },
  { ticker:"VMC",   name:"Vulcan Materials",     sector:"Materials",       industry:"Construction Materials",base:275,  mktCap:36,   pe:30,  divYield:0.0065, w52hi:302, w52lo:228 },
  { ticker:"ALB",   name:"Albemarle",            sector:"Materials",       industry:"Specialty Chemicals",   base:78,   mktCap:9.2,  pe:0,   divYield:0.0160, w52hi:160, w52lo:63  },
  // Real Estate
  { ticker:"PLD",   name:"Prologis",             sector:"RealEstate",      industry:"Industrial REITs",      base:115,  mktCap:107,  pe:32,  divYield:0.0322, w52hi:135, w52lo:97  },
  { ticker:"AMT",   name:"American Tower",       sector:"RealEstate",      industry:"Cell Tower REITs",      base:215,  mktCap:100,  pe:42,  divYield:0.0270, w52hi:243, w52lo:168 },
  { ticker:"EQIX",  name:"Equinix",              sector:"RealEstate",      industry:"Data Center REITs",     base:895,  mktCap:86,   pe:82,  divYield:0.0217, w52hi:963, w52lo:714 },
  { ticker:"PSA",   name:"Public Storage",       sector:"RealEstate",      industry:"Self Storage REITs",    base:318,  mktCap:55,   pe:28,  divYield:0.0415, w52hi:363, w52lo:265 },
  { ticker:"SPG",   name:"Simon Property",       sector:"RealEstate",      industry:"Retail REITs",          base:165,  mktCap:54,   pe:22,  divYield:0.0430, w52hi:185, w52lo:140 },
  { ticker:"DLR",   name:"Digital Realty",       sector:"RealEstate",      industry:"Data Center REITs",     base:165,  mktCap:48,   pe:0,   divYield:0.0290, w52hi:175, w52lo:107 },
  { ticker:"WELL",  name:"Welltower",            sector:"RealEstate",      industry:"Healthcare REITs",      base:135,  mktCap:65,   pe:143, divYield:0.0209, w52hi:142, w52lo:92  },
  { ticker:"O",     name:"Realty Income",        sector:"RealEstate",      industry:"Retail REITs",          base:57,   mktCap:38,   pe:41,  divYield:0.0570, w52hi:64,  w52lo:46  },
  // Utilities
  { ticker:"NEE",   name:"NextEra Energy",       sector:"Utilities",       industry:"Electric Utilities",    base:72,   mktCap:147,  pe:22,  divYield:0.0295, w52hi:85,  w52lo:57  },
  { ticker:"SO",    name:"Southern Company",     sector:"Utilities",       industry:"Electric Utilities",    base:88,   mktCap:95,   pe:22,  divYield:0.0329, w52hi:92,  w52lo:68  },
  { ticker:"DUK",   name:"Duke Energy",          sector:"Utilities",       industry:"Electric Utilities",    base:118,  mktCap:91,   pe:20,  divYield:0.0361, w52hi:124, w52lo:89  },
  { ticker:"AEP",   name:"American Elec Power",  sector:"Utilities",       industry:"Electric Utilities",    base:98,   mktCap:52,   pe:19,  divYield:0.0363, w52hi:105, w52lo:78  },
  { ticker:"SRE",   name:"Sempra",               sector:"Utilities",       industry:"Electric Utilities",    base:78,   mktCap:49,   pe:16,  divYield:0.0339, w52hi:90,  w52lo:64  },
  { ticker:"EXC",   name:"Exelon",               sector:"Utilities",       industry:"Electric Utilities",    base:38,   mktCap:37,   pe:15,  divYield:0.0421, w52hi:42,  w52lo:33  },
  { ticker:"XEL",   name:"Xcel Energy",          sector:"Utilities",       industry:"Electric Utilities",    base:65,   mktCap:36,   pe:19,  divYield:0.0348, w52hi:70,  w52lo:52  },
  { ticker:"AWK",   name:"American Water Works", sector:"Utilities",       industry:"Water Utilities",       base:135,  mktCap:26,   pe:28,  divYield:0.0200, w52hi:156, w52lo:113 },
  { ticker:"PEG",   name:"PSEG",                 sector:"Utilities",       industry:"Electric Utilities",    base:78,   mktCap:41,   pe:17,  divYield:0.0321, w52hi:85,  w52lo:58  },
];

/* ── Sector metadata ───────────────────────────────────────────── */

const SECTORS: { id: Sector | "All"; label: string; short: string; etf: string }[] = [
  { id: "All",            label: "All Sectors",       short: "ALL",  etf: "SPY"  },
  { id: "Technology",     label: "Technology",        short: "TECH", etf: "XLK"  },
  { id: "HealthCare",     label: "Health Care",       short: "HLTH", etf: "XLV"  },
  { id: "Financials",     label: "Financials",        short: "FINL", etf: "XLF"  },
  { id: "ConsumerDisc",   label: "Cons Discret",      short: "DISC", etf: "XLY"  },
  { id: "CommServices",   label: "Comm Services",     short: "COMM", etf: "XLC"  },
  { id: "Industrials",    label: "Industrials",       short: "INDU", etf: "XLI"  },
  { id: "ConsumerStaples",label: "Cons Staples",      short: "STPL", etf: "XLP"  },
  { id: "Energy",         label: "Energy",            short: "NRG",  etf: "XLE"  },
  { id: "Materials",      label: "Materials",         short: "MAT",  etf: "XLB"  },
  { id: "RealEstate",     label: "Real Estate",       short: "REIT", etf: "XLRE" },
  { id: "Utilities",      label: "Utilities",         short: "UTIL", etf: "XLU"  },
];

const SECTOR_COLORS: Record<Sector, string> = {
  Technology:      "text-sky-400",
  HealthCare:      "text-rose-400",
  Financials:      "text-amber-400",
  ConsumerDisc:    "text-violet-400",
  CommServices:    "text-cyan-400",
  Industrials:     "text-blue-400",
  ConsumerStaples: "text-lime-400",
  Energy:          "text-orange-400",
  Materials:       "text-teal-400",
  RealEstate:      "text-pink-400",
  Utilities:       "text-indigo-400",
};

const TICK = 0.01;

/* ── Build rows ────────────────────────────────────────────────── */

function buildRows(meta: StockMeta[]): StockRow[] {
  return meta.map((m, i) => {
    const seed      = m.ticker.charCodeAt(0) * 13 + i * 7;
    const drift     = ((seed % 21) - 10) * 0.004 * m.base;
    const price     = Math.round((m.base + drift) * 100) / 100;
    const prevDrift = ((seed * 3 % 15) - 7) * 0.003 * m.base;
    const prev      = Math.round((m.base + prevDrift) * 100) / 100;
    const chg       = Math.round((price - prev) * 100) / 100;
    const pct       = Number(((chg / prev) * 100).toFixed(2));
    return {
      ...m, price, prev, chg, pct,
      bid:    Math.round((price - TICK) * 100) / 100,
      ask:    Math.round((price + TICK) * 100) / 100,
      volume: Math.round(1_000_000 + ((seed * 9337) % 80_000_000)),
    };
  });
}

/* ── Formatters ────────────────────────────────────────────────── */

function fmtPx(px: number): string {
  if (!Number.isFinite(px)) return "—";
  return px >= 1000 ? px.toFixed(2) : px.toFixed(2);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtMktCap(b: number): string {
  if (b >= 1000) return `$${(b / 1000).toFixed(2)}T`;
  if (b >= 1) return `$${b.toFixed(1)}B`;
  return `$${(b * 1000).toFixed(0)}M`;
}

/* ── Sparkline ─────────────────────────────────────────────────── */

function Spark({ positive, seed }: { positive: boolean; seed: number }) {
  const pts = useMemo(() => {
    const arr: number[] = [];
    let v = 50;
    for (let i = 0; i < 20; i++) {
      v = Math.max(10, Math.min(90, v + (((seed * (i + 1) * 7) % 21) - 10) * 0.8));
      arr.push(v);
    }
    arr[arr.length - 1] = positive ? Math.max(arr[arr.length - 1], 55) : Math.min(arr[arr.length - 1], 45);
    return arr;
  }, [positive, seed]);

  const d = "M " + pts.map((y, i) => `${(i / (pts.length - 1)) * 60},${50 - (y - 50) * 0.45}`).join(" L ");
  return (
    <svg width="60" height="22" viewBox="0 0 60 50" preserveAspectRatio="none" className="shrink-0 opacity-80">
      <path d={d} fill="none"
        stroke={positive ? "rgba(52,211,153,0.75)" : "rgba(239,68,68,0.75)"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Sector heatmap bar (sidebar) ──────────────────────────────── */

function SectorBar({ rows, live }: { rows: StockRow[]; live: Map<string, LivePrice> }) {
  const avgPct = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      const lp = live.get(r.ticker);
      sum += lp ? lp.pct : r.pct;
    }
    return rows.length ? sum / rows.length : 0;
  }, [rows, live]);

  const pos = avgPct >= 0;
  const w   = Math.min(100, Math.abs(avgPct) * 20);

  return (
    <div className="relative h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={cn("absolute top-0 h-full rounded-full", pos ? "bg-emerald-400/50 left-0" : "bg-red-400/50 right-0")}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/* ── Detail Panel ──────────────────────────────────────────────── */

interface DetailTick { ts: string; price: number; dir: 1 | -1 }

function DetailPanel({ row, live }: { row: StockRow; live: LivePrice | null }) {
  const router = useRouter();
  const [ticks, setTicks] = useState<DetailTick[]>([]);
  const tickRef = useRef(0);

  const price    = live?.price ?? row.price;
  const chg      = live?.chg   ?? row.chg;
  const pct      = live?.pct   ?? row.pct;
  const bid      = live?.bid   ?? row.bid;
  const ask      = live?.ask   ?? row.ask;
  const positive = chg >= 0;

  const w52pct = row.w52hi - row.w52lo > 0
    ? ((price - row.w52lo) / (row.w52hi - row.w52lo)) * 100
    : 50;

  const sectorColor = SECTOR_COLORS[row.sector] ?? "text-emerald-400";

  useEffect(() => {
    tickRef.current = 0;
    const now = Date.now();
    const s   = row.ticker.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    setTicks(
      Array.from({ length: 14 }, (_, i) => {
        const delta = (((s + i * 7) % 7) - 3) * TICK;
        const p     = Math.round((row.price + delta) * 100) / 100;
        const t     = new Date(now - (14 - i) * 2800);
        return { ts: `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`, price: p, dir: (delta >= 0 ? 1 : -1) as 1 | -1 };
      }).reverse()
    );
  }, [row.ticker]);

  useEffect(() => {
    const s   = row.ticker.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    const iv  = setInterval(() => {
      const id    = ++tickRef.current;
      const delta = (((id * 7 + s) % 7) - 3) * TICK;
      const p     = Math.round((price + delta) * 100) / 100;
      const t     = new Date();
      const ts    = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
      setTicks(prev => [{ ts, price: p, dir: (delta >= 0 ? 1 : -1) as 1 | -1 }, ...prev.slice(0, 29)]);
    }, 1800);
    return () => clearInterval(iv);
  }, [row.ticker, price]);

  function openInTerminal() {
    try { localStorage.setItem("imynted:stock:open", JSON.stringify({ symbol: row.ticker, asset: "stock" })); } catch {}
    router.push("/dashboard");
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "rgba(3,7,14,0.7)" }}>

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn("text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded border shrink-0", sectorColor, "border-current/20 bg-current/7")}
            style={{ borderColor: "currentColor", background: "rgba(255,255,255,0.04)" }}>
            {SECTORS.find(s => s.id === row.sector)?.short ?? "EQ"}
          </span>
          <span className="text-[9px] text-white/35 font-mono">{row.ticker}</span>
        </div>
        <p className="text-[10px] text-white/40 leading-tight mb-2 truncate">{row.name}</p>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className={cn("text-[24px] font-black tabular-nums leading-none", positive ? "text-emerald-300" : "text-red-400")}>
              ${fmtPx(price)}
            </p>
            <p className={cn("text-[11px] font-semibold tabular-nums mt-0.5", positive ? "text-emerald-400" : "text-red-400")}>
              {positive ? "+" : ""}${fmtPx(chg)}&nbsp;&nbsp;{positive ? "+" : ""}{pct.toFixed(2)}%
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button onClick={openInTerminal}
              className="flex items-center gap-1.5 rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/[0.15] transition-colors">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 9 L5 5 L9 1M6 1h3v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Trade
            </button>
            <button onClick={() => { try { navigator.clipboard.writeText(row.ticker); } catch {} }}
              className="rounded border border-white/[0.07] px-2.5 py-1 text-[9px] text-white/25 hover:text-white/55 transition-colors">
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Bid / Ask */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        <div className="px-3 py-2 border-r border-white/[0.04]">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Bid</p>
          <p className="text-[13px] font-bold text-emerald-300/80 tabular-nums">${fmtPx(bid)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Ask</p>
          <p className="text-[13px] font-bold text-red-300/80 tabular-nums">${fmtPx(ask)}</p>
        </div>
      </div>

      {/* 52W range */}
      <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex justify-between mb-1.5">
          <span className="text-[8px] text-white/18">52W Lo: ${fmtPx(row.w52lo)}</span>
          <span className="text-[8px] text-white/18">52W Hi: ${fmtPx(row.w52hi)}</span>
        </div>
        <div className="relative h-1 rounded-full bg-white/[0.06]">
          <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-400/35"
            style={{ width: `${Math.min(100, Math.max(0, w52pct))}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 border border-black"
            style={{ left: `calc(${Math.min(100, Math.max(0, w52pct))}% - 4px)` }} />
        </div>
        <p className="text-[8px] text-white/15 mt-1">{w52pct.toFixed(0)}% of 52-wk range</p>
      </div>

      {/* Stats */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        {[
          { l: "Mkt Cap",    v: fmtMktCap(row.mktCap),                                         s: "" },
          { l: "P/E",        v: row.pe > 0 ? row.pe.toFixed(1) : "N/A",                        s: "trailing" },
          { l: "Div Yield",  v: row.divYield > 0 ? `${(row.divYield * 100).toFixed(2)}%` : "—",s: "annual" },
          { l: "Sector",     v: SECTORS.find(s => s.id === row.sector)?.label ?? row.sector,    s: "" },
          { l: "Prev Close", v: `$${fmtPx(row.prev)}`,                                         s: "" },
          { l: "Spread",     v: `$${fmtPx(ask - bid)}`,                                        s: "bid-ask" },
          { l: "Volume",     v: fmtVol(row.volume),                                             s: "shares" },
          { l: "ETF Proxy",  v: SECTORS.find(s => s.id === row.sector)?.etf ?? "—",            s: "sector ETF" },
        ].map(s => (
          <div key={s.l} className="px-3 py-2 border-r border-b border-white/[0.03] even:border-r-0">
            <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="text-[11px] font-bold text-white/75 tabular-nums truncate">{s.v}</p>
            {s.s && <p className="text-[8px] text-white/18">{s.s}</p>}
          </div>
        ))}
      </div>

      {/* Tick tape */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 grid grid-cols-3 px-3 py-1.5 border-b border-white/[0.04]">
          <span className="text-[8px] text-white/18 uppercase tracking-widest">Time</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Price</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Dir</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ticks.map((t, i) => (
            <div key={i} className={cn("grid grid-cols-3 px-3 py-[3px] border-b border-white/[0.02]", i === 0 && "bg-white/[0.02]")}>
              <span className="text-[10px] text-white/22 tabular-nums font-mono">{t.ts}</span>
              <span className={cn("text-[10px] font-bold tabular-nums text-right", t.dir === 1 ? "text-emerald-300" : "text-red-400")}>
                ${fmtPx(t.price)}
              </span>
              <span className={cn("text-[9px] text-right", t.dir === 1 ? "text-emerald-400" : "text-red-400")}>
                {t.dir === 1 ? "▲" : "▼"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Heat map ──────────────────────────────────────────────────── */

function heatBg(pct: number): string {
  if (pct >=  3) return "rgba(52,211,153,0.80)";
  if (pct >=  2) return "rgba(52,211,153,0.58)";
  if (pct >=  1) return "rgba(52,211,153,0.38)";
  if (pct >=  0) return "rgba(52,211,153,0.16)";
  if (pct >= -1) return "rgba(248,113,113,0.16)";
  if (pct >= -2) return "rgba(248,113,113,0.38)";
  if (pct >= -3) return "rgba(248,113,113,0.58)";
  return "rgba(248,113,113,0.80)";
}

function heatFg(pct: number): string {
  return pct >= 0 ? "#6ee7b7" : "#f87171";
}

function heatBorder(pct: number): string {
  if (pct >=  1) return "rgba(52,211,153,0.35)";
  if (pct >=  0) return "rgba(52,211,153,0.18)";
  if (pct >= -1) return "rgba(248,113,113,0.18)";
  return "rgba(248,113,113,0.35)";
}

function pillDims(mktCap: number): { w: number; h: number } {
  if (mktCap >= 2000) return { w: 130, h: 100 };
  if (mktCap >= 1000) return { w: 112, h: 88 };
  if (mktCap >=  500) return { w: 98,  h: 78 };
  if (mktCap >=  200) return { w: 84,  h: 68 };
  if (mktCap >=  100) return { w: 74,  h: 60 };
  if (mktCap >=   50) return { w: 66,  h: 54 };
  return { w: 58, h: 48 };
}

function fmtCap(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
  return `$${v.toFixed(0)}B`;
}

function HeatMap({
  allRows, tableRows, sector, setSector, livePrices, setSelected,
}: {
  allRows:     StockRow[];
  tableRows:   StockRow[];
  sector:      Sector | "All";
  setSector:   (s: Sector | "All") => void;
  livePrices:  Map<string, LivePrice>;
  setSelected: (r: StockRow) => void;
}) {
  // Sector-level summaries for the top strip
  const sectorSummaries = useMemo(() =>
    SECTORS.filter(s => s.id !== "All").map(s => {
      const rows   = allRows.filter(r => r.sector === s.id);
      const avgPct = rows.length
        ? rows.reduce((sum, r) => sum + (livePrices.get(r.ticker)?.pct ?? r.pct), 0) / rows.length
        : 0;
      return { ...s, avgPct, count: rows.length };
    })
  , [allRows, livePrices]);

  // Group by sector → industry → stocks
  const groups = useMemo(() => {
    const sectorList = sector !== "All"
      ? SECTORS.filter(s => s.id === sector)
      : SECTORS.filter(s => s.id !== "All");

    return sectorList.map(s => {
      const sectorRows = sector !== "All" ? tableRows : allRows
        .filter(r => r.sector === s.id)
        .map(r => { const lp = livePrices.get(r.ticker); return lp ? { ...r, price: lp.price, chg: lp.chg, pct: lp.pct } : r; });

      // Group by industry within this sector
      const industryMap = new Map<string, StockRow[]>();
      for (const r of sectorRows) {
        const ind = (r as StockRow & { industry: string }).industry ?? "Other";
        if (!industryMap.has(ind)) industryMap.set(ind, []);
        industryMap.get(ind)!.push(r);
      }
      // Sort industries by total mktCap desc
      const industries = [...industryMap.entries()]
        .map(([name, stocks]) => ({
          name,
          stocks: stocks.sort((a, b) => b.mktCap - a.mktCap),
          avgPct: stocks.reduce((sum, r) => sum + (livePrices.get(r.ticker)?.pct ?? r.pct), 0) / stocks.length,
          totalCap: stocks.reduce((sum, r) => sum + r.mktCap, 0),
        }))
        .sort((a, b) => b.totalCap - a.totalCap);

      const sectorAvgPct = sectorRows.length
        ? sectorRows.reduce((sum, r) => sum + (livePrices.get(r.ticker)?.pct ?? r.pct), 0) / sectorRows.length
        : 0;

      return { ...s, industries, sectorAvgPct };
    });
  }, [allRows, tableRows, sector, livePrices]);

  return (
    <div className="flex-1 overflow-auto p-3">

      {/* ── Sector summary strip ── */}
      <div className="flex flex-wrap gap-1 md:gap-1.5 mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5 mr-2 self-center shrink-0">
          <span className="text-[8px] font-black tracking-[0.16em] text-emerald-400/60 uppercase">iMYNTED</span>
          <span className="text-white/15">·</span>
          <span className="text-[8px] font-black tracking-[0.16em] text-white/35 uppercase">HEAT</span>
        </div>
        {sectorSummaries.map(s => {
          const active = sector === s.id;
          const up = s.avgPct >= 0;
          return (
            <button
              key={s.id}
              onClick={() => setSector(sector === s.id ? "All" : s.id as Sector)}
              className="flex flex-col items-center justify-center px-2 md:px-3 py-1.5 md:py-2 rounded-sm transition-all shrink-0 gap-0.5"
              style={{
                minWidth: 68,
                background: active ? heatBg(s.avgPct) : `linear-gradient(135deg, ${heatBg(s.avgPct)}, rgba(5,13,20,0.6))`,
                border:     `1px solid ${active ? (up ? "rgba(52,211,153,0.40)" : "rgba(248,113,113,0.40)") : "rgba(255,255,255,0.08)"}`,
                boxShadow:  active ? `0 0 16px 0 ${up ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}, inset 0 0 8px ${up ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)"}` : "none",
              }}
            >
              <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)" }}>
                {s.etf}
              </span>
              <span className="text-[14px] font-black tabular-nums leading-none" style={{ color: heatFg(s.avgPct) }}>
                {up ? "+" : ""}{s.avgPct.toFixed(2)}%
              </span>
              <span className="text-[7px] leading-none uppercase tracking-wider" style={{ color: active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.25)" }}>{s.short}</span>
            </button>
          );
        })}
      </div>

      {/* ── Sector → Industry → Stock groups ── */}
      {groups.map(g => (
        <div key={g.id} className="mb-6">

          {/* Sector header (only shown in All view) — iMYNTED branded */}
          {sector === "All" && (
            <div className="flex items-center gap-2 mb-3">
              <div
                className="px-3 py-1.5 rounded-sm flex items-center gap-2.5"
                style={{
                  background: `linear-gradient(135deg, ${heatBg(g.sectorAvgPct)}, rgba(5,13,20,0.5))`,
                  border: `1px solid ${heatBorder(g.sectorAvgPct)}`,
                }}
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-white/85">{g.label}</span>
                <span className="text-[12px] font-black tabular-nums" style={{ color: heatFg(g.sectorAvgPct) }}>
                  {g.sectorAvgPct >= 0 ? "+" : ""}{g.sectorAvgPct.toFixed(2)}%
                </span>
                <span className="rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold text-white/40 uppercase tracking-wide">{g.etf}</span>
              </div>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
          )}

          {/* Industries within sector */}
          {g.industries.map(ind => (
            <div key={ind.name} className="mb-4">
              {/* Industry header pill — iMYNTED branded */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-sm shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${heatBg(ind.avgPct)}, rgba(5,13,20,0.5))`,
                    border: `1px solid ${heatBorder(ind.avgPct)}`,
                  }}
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/70">{ind.name}</span>
                  <span className="text-[11px] font-black tabular-nums" style={{ color: heatFg(ind.avgPct) }}>
                    {ind.avgPct >= 0 ? "+" : ""}{ind.avgPct.toFixed(2)}%
                  </span>
                </div>
                <span className="text-[8px] text-white/25">{ind.stocks.length} stocks</span>
              </div>

              {/* Stock pills — iMYNTED branded */}
              <div className="flex flex-wrap gap-1 md:gap-1.5 pl-0 md:pl-1">
                {ind.stocks.map(r => {
                  const lp   = livePrices.get(r.ticker);
                  const pct  = lp?.pct   ?? r.pct;
                  const px   = lp?.price ?? r.price;
                  const dims = pillDims(r.mktCap);
                  const big  = dims.w >= 98;
                  const mid  = dims.w >= 74;
                  return (
                    <button
                      key={r.ticker}
                      onClick={() => { setSelected(r); try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: r.ticker, asset: "stock" } })); } catch {} }}
                      title={`${r.name} · ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% · $${fmtPx(px)} · ${fmtCap(r.mktCap)}`}
                      className="flex flex-col items-center justify-center rounded-sm transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95 relative overflow-hidden group"
                      style={{
                        minWidth:   Math.max(dims.w * 0.65, 52),
                        flex:       `1 1 ${dims.w}px`,
                        maxWidth:   dims.w * 1.8,
                        height:     dims.h,
                        background: `linear-gradient(145deg, ${heatBg(pct)}, rgba(5,13,20,0.3))`,
                        border:     `1px solid ${heatBorder(pct)}`,
                      }}
                    >
                      {/* Glow on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${pct >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"}, transparent)` }} />
                      {/* Ticker */}
                      <span className="font-black leading-none tracking-tight relative z-10"
                        style={{ fontSize: big ? 14 : mid ? 12 : 10, color: "rgba(255,255,255,0.92)" }}>
                        {r.ticker}
                      </span>
                      {/* % change */}
                      <span className="font-bold tabular-nums leading-none mt-0.5 relative z-10"
                        style={{ fontSize: big ? 12 : mid ? 10 : 9, color: heatFg(pct) }}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                      {/* Price — shown on mid+ pills */}
                      {mid && (
                        <span className="tabular-nums mt-0.5 relative z-10"
                          style={{ fontSize: big ? 9 : 8, color: "rgba(255,255,255,0.45)" }}>
                          ${fmtPx(px)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

type SortCol = "ticker" | "price" | "chg" | "pct" | "volume" | "mktCap" | "pe" | "divYield";

export default function SectorsPage() {
  const [sector, setSector]         = useState<Sector | "All">("All");
  const [selected, setSelected]     = useState<StockRow | null>(null);
  const [sortCol, setSortCol]       = useState<SortCol>("mktCap");
  const [sortDir, setSortDir]       = useState<1 | -1>(-1);
  const [view, setView]             = useState<"table" | "heat">("heat");
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [panelWidth, setPanelWidth] = useState(272);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: panelWidth };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setPanelWidth(Math.max(200, Math.min(520, dragRef.current.startW + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const allRows = useMemo(() => buildRows(STOCKS), []);

  useEffect(() => {
    const m = new Map<string, LivePrice>();
    for (const r of allRows) {
      m.set(r.ticker, { price: r.price, bid: r.bid, ask: r.ask, chg: r.chg, pct: r.pct, dir: r.chg >= 0 ? 1 : -1 });
    }
    setLivePrices(m);
  }, [allRows]);

  useEffect(() => {
    if (!allRows.length) return;
    const iv = setInterval(() => {
      setLivePrices(prev => {
        const next = new Map(prev);
        const keys = [...next.keys()];
        for (let n = 0; n < 8; n++) {
          const tk  = keys[Math.floor(Math.random() * keys.length)];
          const cur = next.get(tk); if (!cur) continue;
          const row = allRows.find(r => r.ticker === tk); if (!row) continue;
          const dir: 1 | -1 = Math.random() < 0.52 ? 1 : -1;
          const np  = Math.round((cur.price + dir * TICK * (1 + Math.floor(Math.random() * 4))) * 100) / 100;
          const nc  = Math.round((np - row.prev) * 100) / 100;
          const npt = Number(((nc / row.prev) * 100).toFixed(2));
          next.set(tk, { price: np, bid: np - TICK, ask: np + TICK, chg: nc, pct: npt, dir });
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(iv);
  }, [allRows]);

  const tableRows = useMemo(() => {
    const base   = sector === "All" ? allRows : allRows.filter(r => r.sector === sector);
    const merged = base.map(r => {
      const live = livePrices.get(r.ticker);
      return live ? { ...r, price: live.price, bid: live.bid, ask: live.ask, chg: live.chg, pct: live.pct } : r;
    });
    return [...merged].sort((a, b) => {
      if (sortCol === "ticker") return sortDir * a.ticker.localeCompare(b.ticker);
      return sortDir * ((a[sortCol] as number) - (b[sortCol] as number));
    });
  }, [allRows, sector, sortCol, sortDir, livePrices]);

  // sector rows for sidebar
  const sectorStats = useMemo(() => {
    return SECTORS.filter(s => s.id !== "All").map(s => {
      const rows = allRows.filter(r => r.sector === s.id);
      return { ...s, rows };
    });
  }, [allRows]);

  useEffect(() => {
    if (!selected && tableRows.length > 0) setSelected(tableRows[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 1 ? -1 : 1); return col; }
      setSortDir(-1);
      return col;
    });
  }, []);

  const handleSelectStock = useCallback((row: StockRow) => {
    setSelected(row);
    // On mobile, show the detail sheet
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setShowMobileDetail(true);
    }
  }, []);

  const selectedLive = selected ? (livePrices.get(selected.ticker) ?? null) : null;

  const TH = ({ col, label, right }: { col: SortCol; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(col)}
      className={cn(
        "px-3 py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-white/60 transition-colors whitespace-nowrap",
        sortCol === col ? "text-emerald-400/80" : "text-white/25",
        right && "text-right"
      )}>
      {label}{sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* ── Mobile sector filter (horizontal scroll pills) ── */}
      <div className="md:hidden shrink-0 border-b border-white/[0.06] px-2 py-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 w-max">
          <span className="text-[9px] font-black tracking-[0.14em] text-emerald-400/80 uppercase shrink-0 mr-1">Sectors</span>
          {SECTORS.map(s => {
            const isActive = sector === s.id;
            const sRows = s.id === "All" ? allRows : allRows.filter(r => r.sector === (s.id as Sector));
            const avgPct = sRows.length
              ? sRows.reduce((sum, r) => sum + (livePrices.get(r.ticker)?.pct ?? r.pct), 0) / sRows.length
              : 0;
            const pos = avgPct >= 0;
            return (
              <button key={s.id} onClick={() => setSector(s.id as Sector | "All")}
                className={cn(
                  "shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded transition-colors",
                  isActive
                    ? "bg-emerald-400/[0.12] border border-emerald-400/30"
                    : "border border-white/[0.08] hover:bg-white/[0.04]"
                )}>
                <span className={cn("text-[9px] font-bold leading-none", isActive ? "text-emerald-300" : "text-white/50")}>{s.short}</span>
                <span className={cn("text-[8px] font-bold tabular-nums leading-none mt-0.5", pos ? "text-emerald-400/70" : "text-red-400/70")}>
                  {pos ? "+" : ""}{avgPct.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Left sidebar (desktop only) ─────────────────────────────── */}
      <div className="hidden md:flex w-[196px] shrink-0 h-full flex-col border-r border-white/[0.06] overflow-y-auto">

        <div className="shrink-0 px-3 pt-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
            <span className="text-white/[0.15] text-[9px]">|</span>
            <span className="text-[12px] font-bold text-white/80 tracking-wide">Sectors</span>
          </div>
          <p className="text-[8px] text-white/20 mt-0.5">{allRows.length} stocks · 11 sectors</p>
        </div>

        {/* All button */}
        <button onClick={() => setSector("All")}
          className={cn(
            "shrink-0 w-full px-3 py-2 flex items-center justify-between border-b border-white/[0.06] transition-colors",
            sector === "All" ? "bg-emerald-400/[0.07] border-l-[2px] border-l-emerald-400/40" : "hover:bg-white/[0.02] border-l-[2px] border-l-transparent"
          )}>
          <span className={cn("text-[10px] font-bold", sector === "All" ? "text-emerald-300" : "text-white/50")}>All Sectors</span>
          <span className="text-[9px] text-white/25">{allRows.length}</span>
        </button>

        {/* Sector list */}
        <div className="flex-1 overflow-y-auto">
          {sectorStats.map(s => {
            const isActive = sector === s.id;
            const color    = SECTOR_COLORS[s.id as Sector] ?? "text-emerald-400";
            const stocks   = s.rows.length;
            const avgs = s.rows.reduce((acc, r) => {
              const lp = livePrices.get(r.ticker);
              acc.pct += lp ? lp.pct : r.pct;
              return acc;
            }, { pct: 0 });
            const avgPct  = stocks ? avgs.pct / stocks : 0;
            const pos     = avgPct >= 0;

            return (
              <button key={s.id} onClick={() => setSector(s.id as Sector)}
                className={cn(
                  "w-full px-3 py-2.5 border-b border-white/[0.03] transition-colors text-left",
                  isActive
                    ? "bg-emerald-400/[0.07] border-l-[2px] border-l-emerald-400/40"
                    : "hover:bg-white/[0.025] border-l-[2px] border-l-transparent"
                )}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[10px] font-bold", isActive ? "text-white/90" : "text-white/55")}>
                    {s.label}
                  </span>
                  <span className={cn("text-[10px] font-bold tabular-nums", pos ? "text-emerald-400" : "text-red-400")}>
                    {pos ? "+" : ""}{avgPct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <SectorBar rows={s.rows} live={livePrices} />
                  </div>
                  <span className={cn("text-[8px] font-bold shrink-0", color)}>{s.etf}</span>
                </div>
                <p className="text-[8px] text-white/18 mt-0.5">{stocks} stocks</p>
              </button>
            );
          })}
        </div>

        <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.04]">
          <p className="text-[8px] text-white/14">Sim · No live feed connected</p>
        </div>
      </div>

      {/* ── Center ───────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">

        <div className="shrink-0 flex items-center gap-3 px-4 h-[38px] border-b border-white/[0.06]"
          style={{ background: "rgba(3,7,14,0.5)" }}>
          <span className="text-[10px] font-bold text-white/35 tracking-wide">
            {sector === "All" ? "All Sectors" : SECTORS.find(s => s.id === sector)?.label ?? sector}
          </span>
          <span className="text-[9px] text-white/18 tabular-nums">{tableRows.length} stocks</span>

          {/* View toggle */}
          <div className="flex items-center rounded border border-white/[0.08] overflow-hidden ml-2">
            <button onClick={() => setView("heat")}
              className={cn("px-2.5 py-1 text-[8px] font-black tracking-widest uppercase transition-colors",
                view === "heat" ? "bg-emerald-400/[0.12] text-emerald-300" : "text-white/22 hover:text-white/50")}>
              HEAT
            </button>
            <div className="w-px h-3.5 bg-white/[0.08]" />
            <button onClick={() => setView("table")}
              className={cn("px-2.5 py-1 text-[8px] font-black tracking-widest uppercase transition-colors",
                view === "table" ? "bg-emerald-400/[0.12] text-emerald-300" : "text-white/22 hover:text-white/50")}>
              LIST
            </button>
          </div>

          <div className="ml-auto hidden md:flex items-center gap-0.5 overflow-x-auto">
            {SECTORS.map(s => (
              <button key={s.id} onClick={() => setSector(s.id)}
                className={cn(
                  "px-2 py-1 rounded text-[8px] font-semibold border transition-colors shrink-0",
                  sector === s.id
                    ? "bg-emerald-400/[0.08] text-emerald-300 border-emerald-400/20"
                    : "text-white/22 hover:text-white/50 border-transparent"
                )}>
                {s.short}
              </button>
            ))}
          </div>
        </div>

        {view === "heat" ? (
          <HeatMap
            allRows={allRows}
            tableRows={tableRows}
            sector={sector}
            setSector={setSector}
            livePrices={livePrices}
            setSelected={handleSelectStock}
          />
        ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10" style={{ background: "rgba(3,7,14,0.97)" }}>
              <tr className="border-b border-white/[0.06]">
                <th className="hidden md:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/18 w-7">#</th>
                <TH col="ticker"   label="Ticker"    />
                <th className="hidden md:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25">Name</th>
                <th className="hidden lg:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25">Sector</th>
                <TH col="price"    label="Price"     right />
                <TH col="pct"      label="% Chg"     right />
                <th className="hidden md:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Chg</th>
                <th className="hidden lg:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Bid</th>
                <th className="hidden lg:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Ask</th>
                <TH col="volume"   label="Volume"    right />
                <TH col="mktCap"   label="Mkt Cap"   right />
                <th className="hidden lg:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">P/E</th>
                <th className="hidden lg:table-cell px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Div%</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const pos        = row.chg >= 0;
                const isSelected = selected?.ticker === row.ticker;
                const dir        = livePrices.get(row.ticker)?.dir;
                const sColor     = SECTOR_COLORS[row.sector] ?? "text-emerald-400";
                return (
                  <tr key={row.ticker} onClick={() => handleSelectStock(row)}
                    className={cn(
                      "border-b border-white/[0.025] cursor-pointer transition-colors",
                      isSelected ? "bg-emerald-400/[0.05]" : "hover:bg-white/[0.02]"
                    )}>
                    <td className="hidden md:table-cell px-3 py-1.5 text-[10px] text-white/14 tabular-nums">{idx + 1}</td>
                    <td className="px-2 md:px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />}
                        <span className="text-[11px] font-bold text-white/85 font-mono">{row.ticker}</span>
                        {dir && <span className={cn("text-[8px]", dir === 1 ? "text-emerald-400" : "text-red-400")}>{dir === 1 ? "▲" : "▼"}</span>}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 py-1.5 max-w-[160px] truncate text-[10px] text-white/35">{row.name}</td>
                    <td className="hidden lg:table-cell px-3 py-1.5">
                      <span className={cn("text-[8px] font-bold", sColor)}>
                        {SECTORS.find(s => s.id === row.sector)?.short ?? row.sector}
                      </span>
                    </td>
                    <td className={cn("px-2 md:px-3 py-1.5 text-[11px] font-bold tabular-nums text-right", pos ? "text-emerald-300" : "text-red-400")}>
                      ${fmtPx(row.price)}
                    </td>
                    <td className={cn("px-2 md:px-3 py-1.5 text-[11px] font-semibold tabular-nums text-right", pos ? "text-emerald-400" : "text-red-400")}>
                      {pos ? "+" : ""}{row.pct.toFixed(2)}%
                    </td>
                    <td className={cn("hidden md:table-cell px-3 py-1.5 text-[10px] tabular-nums text-right", pos ? "text-emerald-400/60" : "text-red-400/60")}>
                      {pos ? "+" : ""}${fmtPx(row.chg)}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-1.5 text-[10px] text-emerald-400/50 tabular-nums text-right">${fmtPx(row.bid)}</td>
                    <td className="hidden lg:table-cell px-3 py-1.5 text-[10px] text-red-400/50   tabular-nums text-right">${fmtPx(row.ask)}</td>
                    <td className="px-2 md:px-3 py-1.5 text-[10px] text-white/45 tabular-nums text-right">{fmtVol(row.volume)}</td>
                    <td className="px-2 md:px-3 py-1.5 text-[10px] text-white/45 tabular-nums text-right">{fmtMktCap(row.mktCap)}</td>
                    <td className="hidden lg:table-cell px-3 py-1.5 text-[10px] text-white/30 tabular-nums text-right">{row.pe > 0 ? row.pe.toFixed(1) : "—"}</td>
                    <td className="hidden lg:table-cell px-3 py-1.5 text-[10px] text-white/30 tabular-nums text-right">
                      {row.divYield > 0 ? `${(row.divYield * 100).toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* ── Resize handle (desktop only) ────────────────────────────── */}
      <div
        onMouseDown={onDragStart}
        className="hidden md:block w-[5px] shrink-0 h-full cursor-col-resize group relative"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="absolute inset-y-0 left-0 w-[1px] bg-white/[0.06] group-hover:bg-emerald-400/30 transition-colors" />
        <div className="absolute inset-y-0 right-0 w-[1px] bg-transparent group-hover:bg-emerald-400/10 transition-colors" />
      </div>

      {/* ── Right detail panel — hidden on mobile ── */}
      <div className="hidden md:block shrink-0 h-full overflow-hidden" style={{ width: panelWidth }}>
        {selected ? (
          <DetailPanel key={selected.ticker} row={selected} live={selectedLive} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-white/20">Select a stock</p>
          </div>
        )}
      </div>

      {/* ── Mobile detail sheet (slide-up overlay) ── */}
      {showMobileDetail && selected && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileDetail(false)} />
          {/* Sheet */}
          <div className="relative max-h-[75vh] overflow-y-auto rounded-t-xl border-t border-white/[0.08]"
            style={{ background: "rgba(5,13,20,0.98)" }}>
            {/* Close bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]"
              style={{ background: "rgba(5,13,20,0.95)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-white/80 font-mono">{selected.ticker}</span>
                <span className="text-[10px] text-white/35">{selected.name}</span>
              </div>
              <button onClick={() => setShowMobileDetail(false)}
                className="rounded-full w-7 h-7 flex items-center justify-center bg-white/[0.06] text-white/50 hover:text-white/80 transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
            <DetailPanel key={selected.ticker} row={selected} live={selectedLive} />
          </div>
        </div>
      )}
    </div>
  );
}
