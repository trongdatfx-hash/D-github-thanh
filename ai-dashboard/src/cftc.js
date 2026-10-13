// Tang du lieu COT. Dung endpoint Socrata chinh thuc /resource/{id}.json
// thay cho /api/v3/views/{id}/query.json cua ban v2 (khong phai API cong khai).

import { HttpError, fetchText } from "./net.js";
import {
  CFTC_BASE, DATASETS, TFF_FIELDS, LEGACY_FIELDS,
  TFF_SELECT, LEGACY_SELECT, LIMIT_LADDER, PAGE_SIZE, NET_ERROR_HINTS
} from "./config.js";

/** App Token cua Socrata (tuy chon) — dat vao day thi het bi chan toc do. */
let APP_TOKEN = "";
export const setAppToken = (t) => { APP_TOKEN = (t || "").trim(); };
const authHeaders = () => (APP_TOKEN ? { "X-App-Token": APP_TOKEN } : {});

/** So trong API la chuoi co dau phay. Doi sang Number, hong thi tra null. */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Lay mot truong theo danh sach ten uu tien.
 * Khop CHINH XAC truoc, roi moi do gan dung (substring) — nguoc lai voi ban v2,
 * vi ban v2 chi do substring nen "asset_mgr_positions_long_all" khong khop
 * "asset_mgr_positions_long" va lang le tra ve 0.
 *
 * @returns {{value:number|null, key:string|null}}
 */
export function pickField(row, candidates) {
  const keys = Object.keys(row);
  const lower = new Map(keys.map((k) => [k.toLowerCase(), k]));

  for (const c of candidates) {
    const hit = lower.get(c.toLowerCase());
    if (hit !== undefined) {
      const v = toNum(row[hit]);
      if (v !== null) return { value: v, key: hit };
    }
  }
  for (const c of candidates) {
    const hit = keys.find((k) => k.toLowerCase().includes(c.toLowerCase()));
    if (hit) {
      const v = toNum(row[hit]);
      if (v !== null) return { value: v, key: hit };
    }
  }
  return { value: null, key: null };
}

/** Doc ca nhom truong, dong thoi ghi lai truong nao khong map duoc. */
function readGroup(row, spec, report, label) {
  const out = {};
  for (const [name, candidates] of Object.entries(spec)) {
    const { value, key } = pickField(row, candidates);
    out[name] = value ?? 0;
    report.push({
      group: label,
      field: name,
      matched: key,
      ok: key !== null,
      wanted: candidates[0]
    });
  }
  return out;
}

const ORDER = "report_date_as_yyyy_mm_dd DESC";

/**
 * Tu rap query string. KHONG dung URLSearchParams: no ma hoa '$' thanh '%24'
 * va dau cach thanh '+', trong khi moi vi du chay duoc cua Socrata deu dung
 * '$' nguyen ban va '%20'.
 */
function buildUrl(id, params) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%2C/g, ",")}`)
    .join("&");
  return `${CFTC_BASE}/${id}.json?${qs}`;
}

/**
 * Phan biet 403 "chan toc do" voi 403 "chan theo IP/khu vuc".
 * Akamai tra ve trang HTML "Access Denied ... Reference #..." — do la chan
 * o tang WAF/dia ly, khong phai Socrata throttling. Hai thu nay can hai
 * cach xu ly hoan toan khac nhau nen phai tach ra.
 */
export function classifyBlock(err) {
  if (!(err instanceof HttpError)) return null;
  const b = String(err.body || "").toLowerCase();
  if (err.status === 403 &&
      /access denied|don't have permission|doesn't have permission|reference #|akamai/.test(b)) {
    return "geo";
  }
  if (err.status === 429 || /throttl|rate limit|too many requests/.test(b)) return "throttle";
  if (err.status === 403) return "forbidden";
  return null;
}

async function get(url) {
  const text = await fetchText(url, { headers: authHeaders(), retries: 1 });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Phan hoi khong phai JSON: ${String(text).slice(0, 120)}`);
  }
}

function assertRows(rows, id) {
  if (!Array.isArray(rows)) throw new Error(`Dataset ${id} tra ve dinh dang la`);
  return rows;
}

/**
 * Lay du lieu voi nhieu lop du phong. Socrata tra 403 khi bi chan toc do,
 * nen thu tu la: nhe nhat truoc, nang dan; het cach thi phan trang.
 *
 * @returns {{rows:Array, strategy:string, notes:string[]}}
 */
async function queryDataset(id, { contract, limit, select }) {
  const filter = { cftc_contract_market_code: contract };
  const notes = [];

  const plans = [
    { name: `$select + limit ${limit}`,
      params: { ...filter, $select: select.join(","), $order: ORDER, $limit: limit } },
    { name: `full + limit ${limit}`,
      params: { ...filter, $order: ORDER, $limit: limit } },
    { name: `$where + limit ${limit}`,
      params: { $where: `cftc_contract_market_code='${contract}'`, $order: ORDER, $limit: limit } }
  ];

  let lastErr;
  for (const plan of plans) {
    try {
      const rows = assertRows(await get(buildUrl(id, plan.params)), id);
      if (rows.length) return { rows, strategy: plan.name, notes };
      notes.push(`${plan.name}: tra ve 0 dong`);
    } catch (e) {
      lastErr = e;
      notes.push(`${plan.name}: ${e.message.split(" — ")[0]}`);
      // Chan theo IP/khu vuc: doi cach hoi hay ha limit deu vo ich, dung ngay
      // thay vi ban them ~14 request roi bao cung mot loi.
      if (classifyBlock(e) === "geo") { e.blockKind = "geo"; e.notes = notes; throw e; }
      if (e instanceof HttpError && (e.status === 403 || e.status === 429)) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  // Goi lon bi tu choi -> PHAN TRANG truoc, de van giu du so tuan yeu cau.
  // (Ha thang limit xuong 52 thi lay duoc du lieu nhung mat 4/5 lich su,
  //  lam COT Index yeu han — nen chi dung khi phan trang cung hong.)
  try {
    const rows = [];
    for (let offset = 0; offset < limit; offset += PAGE_SIZE) {
      const page = assertRows(await get(buildUrl(id, {
        ...filter, $select: select.join(","), $order: ORDER,
        $limit: Math.min(PAGE_SIZE, limit - offset), $offset: offset
      })), id);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      await new Promise((r) => setTimeout(r, 400)); // gian nhip, tranh bi chan lai
    }
    if (rows.length) {
      notes.push(`Phai phan trang ${PAGE_SIZE} tuan/lan (lay du ${rows.length} tuan).`);
      return { rows, strategy: `phan trang ${PAGE_SIZE}`, notes };
    }
  } catch (e) { lastErr = e; if (classifyBlock(e) === "geo") { e.blockKind = "geo"; e.notes = notes; throw e; } }

  // Cuoi cung moi chap nhan it tuan hon.
  for (const smaller of LIMIT_LADDER.filter((n) => n < limit)) {
    try {
      const rows = assertRows(
        await get(buildUrl(id, { ...filter, $select: select.join(","), $order: ORDER, $limit: smaller })), id);
      if (rows.length) {
        notes.push(`Chi lay duoc ${smaller} tuan thay vi ${limit} — COT Index se kem tin cay hon.`);
        return { rows, strategy: `$select + limit ${smaller}`, notes };
      }
    } catch (e) { lastErr = e; if (classifyBlock(e) === "geo") { e.blockKind = "geo"; e.notes = notes; throw e; } }
  }

  const kind = classifyBlock(lastErr);
  const hint = kind === "geo" ? null
             : lastErr instanceof HttpError ? NET_ERROR_HINTS[lastErr.status] : null;
  const err = new Error(
    `${lastErr?.message || "khong lay duoc du lieu"}${hint ? ` — ${hint}` : ""}`
  );
  err.notes = notes;
  err.blockKind = kind;
  throw err;
}

// ------------------------------------------------------------ nhap du lieu

function detectKind(row) {
  const keys = Object.keys(row || {}).map((k) => k.toLowerCase());
  if (keys.some((k) => k.includes("lev_money"))) return "tff";
  if (keys.some((k) => k.includes("noncomm_positions"))) return "legacy";
  return null;
}

/**
 * Nhan JSON dan tay / tai file / tai tu URL nguon thay the. Chap nhan:
 *  - mang tho tu API CFTC (tu nhan ra TFF hay Legacy qua ten cot)
 *  - goi {tff:[...], legacy:[...]}
 *  - dang cu {lfNet, amNet, dealerNet, ncNet} de ghi de tuan moi nhat
 * @returns {{tff?:Array, legacy?:Array, override?:object}}
 */
export function parseImported(text) {
  let data;
  try { data = typeof text === "string" ? JSON.parse(text) : text; }
  catch { throw new Error("JSON khong hop le"); }

  if (Array.isArray(data)) {
    const kind = detectKind(data[0]);
    if (!kind) throw new Error("Mang JSON khong giong du lieu CFTC (khong thay cot lev_money / noncomm_positions)");
    return { [kind]: data };
  }
  if (data && typeof data === "object") {
    const out = {};
    if (Array.isArray(data.tff)) out.tff = data.tff;
    if (Array.isArray(data.legacy)) out.legacy = data.legacy;
    if (out.tff || out.legacy) return out;
    if (["lfNet", "levNet", "amNet", "assetNet"].some((k) => k in data)) return { override: data };
  }
  throw new Error("Khong nhan ra dinh dang. Can mang JSON tu API CFTC hoac {tff:[...], legacy:[...]}");
}

/** Tai goi du lieu tu URL nguon thay the (Drive, Gist, server rieng...). */
export async function loadBundleFromUrl(url) {
  const text = await fetchText(url, { retries: 1, accept: "application/json, text/plain" });
  const parsed = parseImported(text);
  if (!parsed.tff && !parsed.legacy) throw new Error("URL nguon khong chua mang TFF/Legacy");
  return parsed;
}

const dateOf = (row) =>
  new Date(String(row.report_date_as_yyyy_mm_dd).slice(0, 10) + "T00:00:00Z");

/**
 * Tai lich su COT va gop Legacy + TFF theo ngay bao cao.
 *
 * @returns {{
 *   contract:string, contractName:string, mode:string,
 *   rows:Array, fieldReport:Array, warnings:string[]
 * }}
 */
export async function loadCOT({ contract, mode = "futonly", lookback = 260 } = {}) {
  const ds = DATASETS[mode] ?? DATASETS.futonly;
  const warnings = [];

  // TUAN TU, khong song song — giam so request dong thoi.
  const tff = await queryDataset(ds.tff, {
    contract, limit: lookback, select: TFF_SELECT
  });

  let legacyRows = [], legacyStrategy = "—";
  try {
    const lg = await queryDataset(ds.legacy, {
      contract, limit: lookback, select: LEGACY_SELECT
    });
    legacyRows = lg.rows;
    legacyStrategy = lg.strategy;
  } catch (e) {
    warnings.push(`Khong doc duoc Legacy (${ds.legacy}): ${e.message}`);
  }

  if (tff.notes.length) warnings.push(`TFF: ${tff.notes.join(" · ")}`);

  return buildCOT(tff.rows, legacyRows, {
    contract, mode, warnings,
    strategy: { tff: tff.strategy, legacy: legacyStrategy },
    source: "cftc"
  });
}

/**
 * Dung bo du lieu tu mang tho — dung chung cho ca mang, nhap tay va URL thay the.
 * Neu mang co nhieu hop dong (file dump ca dataset) thi loc theo ma.
 */
export function buildCOT(tffRowsIn, legacyRowsIn, { contract, mode = "futonly", lookback = 0,
                                                    warnings = [], strategy = {}, source = "import" } = {}) {
  const byContract = (rows) => {
    const hasCode = rows.some((r) => r.cftc_contract_market_code);
    const f = hasCode ? rows.filter((r) => String(r.cftc_contract_market_code).trim() === contract) : rows;
    return [...f].sort((a, b) => dateOf(b) - dateOf(a)); // moi nhat truoc, giong API
  };
  let tffRows = byContract(tffRowsIn || []);
  let legacyRes = byContract(legacyRowsIn || []);
  if (lookback > 0) { tffRows = tffRows.slice(0, lookback); legacyRes = legacyRes.slice(0, lookback); }

  if (!tffRows.length) {
    throw new Error(
      `Khong co du lieu TFF cho ma hop dong '${contract}'. Kiem tra lai ma.`
    );
  }

  const fieldReport = [];
  readGroup(tffRows[0], TFF_FIELDS, fieldReport, "TFF");
  if (legacyRes.length) readGroup(legacyRes[0], LEGACY_FIELDS, fieldReport, "Legacy");
  else warnings.push("Bo qua phan Legacy vi khong co du lieu.");

  const legacyByDate = new Map(
    legacyRes.map((r) => [dateOf(r).toISOString().slice(0, 10), r])
  );

  const rows = tffRows
    .map((r) => {
      const t = readGroup(r, TFF_FIELDS, [], "TFF");
      const date = dateOf(r);
      const iso = date.toISOString().slice(0, 10);
      const lr = legacyByDate.get(iso);
      const l = lr ? readGroup(lr, LEGACY_FIELDS, [], "Legacy") : null;

      return {
        date,
        iso,
        oi: t.oi,
        dealerNet: t.dealerLong - t.dealerShort,
        amNet:     t.amLong - t.amShort,
        lfNet:     t.lfLong - t.lfShort,
        dealerLong: t.dealerLong, dealerShort: t.dealerShort,
        amLong: t.amLong, amShort: t.amShort,
        lfLong: t.lfLong, lfShort: t.lfShort,
        ncNet:   l ? l.ncLong - l.ncShort : null,
        commNet: l ? l.cLong - l.cShort : null,
        nrNet:   l ? l.nrLong - l.nrShort : null,
        hasLegacy: !!l
      };
    })
    .sort((a, b) => a.date - b.date); // tang dan theo thoi gian

  const missingLegacy = rows.filter((r) => !r.hasLegacy).length;
  if (legacyRes.length && missingLegacy) {
    warnings.push(
      `${missingLegacy}/${rows.length} tuan khong khop duoc ngay Legacy (hai dataset cap nhat lech nhau).`
    );
  }

  return {
    contract,
    contractName: tffRows[0].contract_market_name || contract,
    market: tffRows[0].market_and_exchange_names || "",
    mode,
    rows,
    fieldReport,
    warnings,
    strategy,
    source,
    tokenUsed: !!APP_TOKEN
  };
}

/**
 * Liet ke moi hop dong co trong ky bao cao moi nhat, de nguoi dung tu chon
 * thay vi phai go tay ma. Tranh doan ma hop dong khong ton tai.
 */
export async function listContracts(mode = "futonly") {
  const ds = DATASETS[mode] ?? DATASETS.futonly;
  // Chi 3 cot, va goi RIENG khi nguoi dung mo dropdown — khong chay luc khoi dong.
  const url = buildUrl(ds.tff, {
    $select: "cftc_contract_market_code,contract_market_name,report_date_as_yyyy_mm_dd",
    $order: ORDER,
    $limit: 400
  });
  const rows = await get(url);
  if (!Array.isArray(rows) || !rows.length) return [];

  const latest = String(rows[0].report_date_as_yyyy_mm_dd).slice(0, 10);
  const seen = new Map();
  for (const r of rows) {
    if (String(r.report_date_as_yyyy_mm_dd).slice(0, 10) !== latest) break;
    const code = r.cftc_contract_market_code;
    if (code && !seen.has(code)) {
      seen.set(code, r.contract_market_name || r.market_and_exchange_names || code);
    }
  }
  return [...seen.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
