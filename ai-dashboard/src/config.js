// Cau hinh chung + cac hang so da duoc kiem chung truc tiep tren API CFTC.

export const CFTC_BASE = "https://publicreporting.cftc.gov/resource";

// 4 dataset id da test that (2026-09): tra ve dung du lieu E-MINI S&P 500.
//   futonly  = Futures Only
//   combined = Futures + Options Combined
export const DATASETS = {
  futonly:  { legacy: "6dca-aqww", tff: "gpe5-46if" },
  combined: { legacy: "jun7-fc8e", tff: "yw9f-hn96" }
};

export const DEFAULT_CONTRACT = "13874A"; // E-MINI S&P 500 - CME
export const DEFAULT_SYMBOL   = "SPY";

// So tuan COT tai ve. 156 tuan = 3 nam, du de xep hang percentile on dinh.
export const LOOKBACK_CHOICES = [156, 260, 520];
export const DEFAULT_LOOKBACK = 260;

export const BOOTSTRAP_PATHS = 20000;

// Ten cot that trong API. Danh sach uu tien: khop chinh xac truoc, roi moi do gan dung.
// Luu y: nhom asset_mgr va lev_money KHONG co hau to "_all" -> day la loi cua ban v2.
export const TFF_FIELDS = {
  dealerLong:  ["dealer_positions_long_all"],
  dealerShort: ["dealer_positions_short_all"],
  amLong:      ["asset_mgr_positions_long", "asset_mgr_positions_long_all"],
  amShort:     ["asset_mgr_positions_short", "asset_mgr_positions_short_all"],
  lfLong:      ["lev_money_positions_long", "lev_money_positions_long_all"],
  lfShort:     ["lev_money_positions_short", "lev_money_positions_short_all"],
  oi:          ["open_interest_all"]
};

// Trong dataset Legacy, CFTC go sai chinh ta cot spread: "noncomm_postions_spread_all"
// (thieu chu 'i'). Giu ca hai cach viet de khong vo khi ho sua.
export const LEGACY_FIELDS = {
  ncLong:   ["noncomm_positions_long_all"],
  ncShort:  ["noncomm_positions_short_all"],
  ncSpread: ["noncomm_postions_spread_all", "noncomm_positions_spread_all", "noncomm_positions_spread"],
  cLong:    ["comm_positions_long_all"],
  cShort:   ["comm_positions_short_all"],
  nrLong:   ["nonrept_positions_long_all"],
  nrShort:  ["nonrept_positions_short_all"],
  oi:       ["open_interest_all"]
};

// Chi lay dung cot can dung. Keo 260 tuan x ~95 cot lam response nang ~1,5 MB
// va de bi Socrata chan toc do (tra 403). Voi $select thi con ~1/10.
export const TFF_SELECT = [
  "report_date_as_yyyy_mm_dd", "contract_market_name", "open_interest_all",
  "dealer_positions_long_all", "dealer_positions_short_all",
  "asset_mgr_positions_long", "asset_mgr_positions_short",
  "lev_money_positions_long", "lev_money_positions_short"
];
export const LEGACY_SELECT = [
  "report_date_as_yyyy_mm_dd", "open_interest_all",
  "noncomm_positions_long_all", "noncomm_positions_short_all",
  "noncomm_postions_spread_all",
  "comm_positions_long_all", "comm_positions_short_all",
  "nonrept_positions_long_all", "nonrept_positions_short_all"
];

// Khi bi chan toc do, ha dan so tuan roi phan trang.
export const LIMIT_LADDER = [260, 156, 104, 52];
export const PAGE_SIZE = 52;

export const NET_ERROR_HINTS = {
  403: "CFTC chan toc do (403) — thuong do goi nhieu request nang cung luc. " +
       "Doi ~1 phut roi bam lai, hoac dan App Token vao o duoi cung de bo gioi han.",
  429: "Bi gioi han so lan goi (429). Doi ~1 phut roi bam lai.",
  404: "Sai dataset id hoac ma hop dong."
};

export const APP_TOKEN_HELP = "https://evergreen.data.socrata.com/signup";
