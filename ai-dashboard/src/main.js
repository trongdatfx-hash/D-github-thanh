// Dieu phoi: tu chay khi mo trang, cache lai, hong mot ben van ve duoc ben kia.
//
// Thu tu uu tien nguon COT:
//   1. du lieu NHAP TAY (neu co)      -> khong goi mang
//   2. URL NGUON THAY THE (neu dat)   -> cho truong hop CFTC chan theo IP
//   3. API CFTC

import { DEFAULT_CONTRACT, DEFAULT_SYMBOL, DEFAULT_LOOKBACK, BOOTSTRAP_PATHS,
         CFTC_BASE, DATASETS, TFF_SELECT } from "./config.js";
import { loadCOT, buildCOT, parseImported, loadBundleFromUrl, listContracts, setAppToken } from "./cftc.js";
import { loadDaily, loadIntraday } from "./prices.js";
import { weeklyBars, conditionalWeekly, weeklyRangeModel, rangeBoxFrom } from "./analytics.js";
import { buildSignals } from "./signals.js";
import { store, CACHE_KEY, PREFS_KEY, IMPORT_KEY } from "./store.js";
import { t, setLang, getLang, applyStaticI18n } from "./i18n.js";
import * as ui from "./ui.js";

const state = {
  cot: null, daily: [], weekly: [], priceInfo: null, prefs: null,
  intraday: [], intradayInfo: null, intradayError: null,
  fromCache: false, contractsLoaded: false, imported: null,
  lastAlerts: { errors: [], warnings: [], html: [] }
};

const DEFAULT_PREFS = {
  contract: DEFAULT_CONTRACT, mode: "futonly", lookback: DEFAULT_LOOKBACK,
  token: "", sourceUrl: "", lang: "vi", tf: "m30"
};

const HOSTED_PAGE = location.protocol === "http:" || location.protocol === "https:";

async function prefs() {
  if (state.prefs) return state.prefs;
  state.prefs = { ...DEFAULT_PREFS, ...(await store.get(PREFS_KEY, {})) };
  return state.prefs;
}

function currentPrefs() {
  return {
    contract: ui.el("contract").value || DEFAULT_CONTRACT,
    mode: ui.el("mode").value,
    lookback: Number(ui.el("lookback").value),
    token: ui.el("token").value.trim(),
    sourceUrl: ui.el("sourceUrl").value.trim(),
    lang: ui.el("lang").value,
    tf: ui.el("tf").value
  };
}

async function loadHostedSnapshot(p) {
  const response = await fetch("data/snapshot.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Hosted snapshot HTTP ${response.status}`);
  const data = await response.json();
  const bars = (rows) => (rows || []).map((b) => ({
    d: new Date(b.t), o: Number(b.o), h: Number(b.h), l: Number(b.l), c: Number(b.c)
  })).filter((b) => !Number.isNaN(b.d.getTime()) && [b.o, b.h, b.l, b.c].every(Number.isFinite));
  return {
    cot: buildCOT(data.tff || [], data.legacy || [], {
      contract: DEFAULT_CONTRACT,
      mode: "futonly",
      lookback: p.lookback,
      source: "GitHub snapshot",
      strategy: { tff: "CFTC annual archive", legacy: "CFTC annual archive" }
    }),
    daily: bars(data.daily),
    intraday: bars(data.intraday),
    generatedAt: data.generated_at
  };
}

/** Ve lai toan bo tu state hien co. Goi duoc ke ca khi chi co mot nua du lieu. */
function render() {
  const { cot, daily, weekly, priceInfo } = state;
  if (!cot) return;

  const p = currentPrefs();
  const sig = buildSignals(cot, weekly, { window: Math.min(p.lookback, cot.rows.length) });

  ui.renderTop(sig, cot);
  ui.renderIndexTable(sig);
  ui.renderNetTable(sig);
  ui.renderSignal(sig);

  if (daily.length && weekly.length) {
    // Nen M30 neu co va nguoi dung chon; khong thi ve nen ngay.
    const useM30 = p.tf === "m30" && state.intraday.length > 20;
    const bars = useM30 ? state.intraday : daily;
    const shown = useM30 ? Math.min(240, bars.length) : Math.min(120, bars.length);
    const src = useM30 ? state.intradayInfo.source : priceInfo.source;

    // Dai bien do tuan: mo hinh HAR + phan vi phan du NGOAI MAU (walk-forward).
    // Luon hoc tren nen NGAY du dang xem M30 — M30 chi co 60 ngay, khong du
    // lich su de kiem dinh tien dan cho ra phan vi dang tin.
    const model = weeklyRangeModel(daily, weekly, { minTrain: 60 });
    const box = rangeBoxFrom(model, weekly[weekly.length - 1]);

    ui.renderSPYStats(daily, weekly, src, shown, bars.length);
    ui.drawChart(bars.slice(-shown), { intraday: useM30, box });
    ui.renderRangeBox(box, model);

    const res = conditionalWeekly(cot.rows, weekly, "lfNet", {
      window: Math.min(p.lookback, cot.rows.length),
      paths: BOOTSTRAP_PATHS
    });
    ui.renderForecast(res);
    ui.renderProb(res);
    ui.renderMatrix(sig, res);
    ui.renderDiag(cot, { ...priceInfo, bars: daily.length }, res, { source: cot.source });
  } else {
    ui.renderDiag(cot, priceInfo || { source: "—", attempts: [], bars: 0 },
                  { reliable: false, conditional: null }, { source: cot.source });
  }
}

/** Chon nguon COT theo thu tu uu tien. */
async function loadCOTAny(p) {
  if (state.imported?.tff?.length) {
    return buildCOT(state.imported.tff, state.imported.legacy || [], {
      contract: p.contract, mode: p.mode, lookback: p.lookback,
      source: "import",
      strategy: { tff: "import", legacy: state.imported.legacy?.length ? "import" : "—" }
    });
  }
  if (p.sourceUrl) {
    const bundle = await loadBundleFromUrl(p.sourceUrl);
    return buildCOT(bundle.tff || [], bundle.legacy || [], {
      contract: p.contract, mode: p.mode, lookback: p.lookback,
      source: "url",
      strategy: { tff: "url", legacy: bundle.legacy?.length ? "url" : "—" }
    });
  }
  return loadCOT({ contract: p.contract, mode: p.mode, lookback: p.lookback });
}

async function refresh({ useCache = false } = {}) {
  const p = currentPrefs();
  await store.set(PREFS_KEY, p);
  setAppToken(p.token);

  const errors = [], warnings = [], html = [];
  let cached = null;

  if (useCache) {
    cached = await store.get(CACHE_KEY);
    if (cached?.cot?.rows?.length) {
      applyCache(cached);
      ui.setStatus(t("st.cache", { t: cached.savedAt?.slice(0, 16).replace("T", " ") }), "yellow");
      try { render(); } catch (e) { console.error(e); }
    }
  }

  ui.setStatus(t("st.loading"), "muted");

  let hosted = null;
  if (HOSTED_PAGE) {
    try { hosted = await loadHostedSnapshot(p); }
    catch (e) { errors.push({ k: "err.cot", p: { m: e.message } }); }
  }
  const jobs = hosted
    ? [Promise.resolve(hosted.cot), Promise.resolve({
        bars: hosted.daily, source: "GitHub snapshot", attempts: [{ name: "GitHub snapshot", ok: true }]
      })]
    : [loadCOTAny(p), loadDaily(DEFAULT_SYMBOL, { years: 10 })];
  if (p.tf === "m30") jobs.push(hosted
    ? Promise.resolve({
        bars: hosted.intraday, source: "GitHub snapshot M30", interval: "30m",
        attempts: [{ name: "GitHub snapshot M30", ok: true }]
      })
    : loadIntraday(DEFAULT_SYMBOL, { interval: "30m", range: "60d" }));

  const [cotRes, priceRes, m30Res] = await Promise.allSettled(jobs);

  if (cotRes.status === "fulfilled") {
    state.cot = cotRes.value;
    state.fromCache = false;
    warnings.push(...cotRes.value.warnings.map((w) => ({ raw: w })));
    if (cotRes.value.source !== "cftc") {
      warnings.push({ k: "warn.altSource", p: { src: cotRes.value.source } });
    }
  } else {
    const e = cotRes.reason;
    if (e.blockKind === "geo") html.push({ k: "warn.geo" });
    else errors.push({ k: "err.cot", p: { m: e.message } });
    // Hong mang thi giu lai cache thay vi de trang trong.
    const fallback = cached || (await store.get(CACHE_KEY));
    if (fallback?.cot?.rows?.length) {
      applyCache(fallback);
      warnings.push({ k: "warn.cacheShown", p: { t: fallback.savedAt?.slice(0, 16).replace("T", " ") } });
    }
  }

  if (priceRes.status === "fulfilled") {
    state.daily = priceRes.value.bars;
    state.weekly = weeklyBars(state.daily);
    state.priceInfo = { source: priceRes.value.source, attempts: priceRes.value.attempts };
  } else {
    errors.push({ k: "err.price", p: { m: priceRes.reason.message } });
    state.priceInfo = state.priceInfo || { source: "—", attempts: [] };
  }

  if (p.tf === "m30") {
    if (m30Res?.status === "fulfilled") {
      state.intraday = m30Res.value.bars;
      state.intradayInfo = m30Res.value;
      state.intradayError = null;
      if (state.priceInfo?.attempts) state.priceInfo.attempts.push(...m30Res.value.attempts);
    } else {
      state.intraday = [];
      state.intradayError = m30Res?.reason?.message || "?";
      warnings.push({ k: "spy.m30Fail", p: { e: state.intradayError } });
    }
  } else {
    state.intraday = [];
  }

  // COT tre hon 10 ngay thuong la do CFTC nghi le hoac dataset chua day.
  if (state.cot) {
    const age = Math.floor((Date.now() - state.cot.rows[state.cot.rows.length - 1].date) / 86400000);
    if (age > 10) warnings.push({ k: "warn.stale", p: { n: age } });
  }

  state.lastAlerts = { errors, warnings, html };
  ui.setAlerts(state.lastAlerts);

  if (!state.cot) {
    ui.setStatus(t("st.failed"), "red");
    return;
  }

  render();

  if (state.fromCache) {
    ui.setStatus(t("st.cacheOnly", { d: state.cot.rows[state.cot.rows.length - 1].iso }), "yellow");
    return; // khong ghi de cache bang chinh no
  }

  ui.setStatus(t("st.updated", {
    t: new Date().toLocaleTimeString(getLang() === "vi" ? "vi-VN" : "en-US"),
    d: state.cot.rows[state.cot.rows.length - 1].iso,
    src: state.priceInfo.source
  }), "green");

  await store.set(CACHE_KEY, {
    savedAt: new Date().toISOString(),
    cot: state.cot,
    daily: state.daily,
    priceInfo: state.priceInfo
  });
}

/** Dung lai state tu cache. Date bi JSON hoa thanh chuoi nen phai phuc hoi. */
function applyCache(cached) {
  state.cot = {
    ...cached.cot,
    rows: cached.cot.rows.map((r) => ({ ...r, date: new Date(r.date) }))
  };
  state.daily = (cached.daily || []).map((b) => ({ ...b, d: new Date(b.d) }));
  state.weekly = weeklyBars(state.daily);
  state.priceInfo = cached.priceInfo || { source: "cache", attempts: [] };
  state.fromCache = true;
}

// ------------------------------------------------------------- nhap du lieu

function showImportState() {
  const n = ui.el("importState");
  if (state.imported?.tff?.length) {
    n.textContent = t("imp.state", {
      tff: state.imported.tff.length,
      legacy: state.imported.legacy?.length ? t("imp.legacyPart", { n: state.imported.legacy.length }) : "",
      d: state.imported.savedAt?.slice(0, 10)
    });
    n.className = "small yellow";
  } else {
    n.textContent = "";
  }
}

async function applyImportText(text) {
  const parsed = parseImported(text);

  if (parsed.override) {
    if (!state.cot) throw new Error(t("imp.noOverride"));
    const x = parsed.override;
    const rows = state.cot.rows;
    const last = { ...rows[rows.length - 1] };
    const map = { lfNet: "lfNet", levNet: "lfNet", amNet: "amNet", assetNet: "amNet",
                  dealerNet: "dealerNet", ncNet: "ncNet", legacyNet: "ncNet" };
    for (const [k, target] of Object.entries(map)) {
      if (x[k] !== undefined && Number.isFinite(Number(x[k]))) last[target] = Number(x[k]);
    }
    state.cot = { ...state.cot, rows: [...rows.slice(0, -1), last] };
    render();
    ui.setStatus(t("st.override"), "yellow");
    return;
  }

  // Gop voi du lieu nhap truoc do (vd: dan TFF truoc, Legacy sau).
  const prev = state.imported || {};
  state.imported = {
    savedAt: new Date().toISOString(),
    tff: parsed.tff || prev.tff || [],
    legacy: parsed.legacy || prev.legacy || []
  };
  await store.set(IMPORT_KEY, state.imported);
  showImportState();
  await refresh();
}

/** Doi ngon ngu: khong goi lai mang, chi dich lai moi thu dang co. */
async function switchLang(l) {
  setLang(l);
  document.documentElement.lang = l;
  applyStaticI18n();
  ui.relabelControls();
  showImportState();
  ui.setAlerts(state.lastAlerts);
  const p = currentPrefs();
  await store.set(PREFS_KEY, p);
  if (state.cot) {
    render();
    ui.setStatus(state.fromCache
      ? t("st.cacheOnly", { d: state.cot.rows[state.cot.rows.length - 1].iso })
      : t("st.updated", {
          t: new Date().toLocaleTimeString(l === "vi" ? "vi-VN" : "en-US"),
          d: state.cot.rows[state.cot.rows.length - 1].iso,
          src: state.priceInfo?.source || "—"
        }), state.fromCache ? "yellow" : "green");
  }
}

async function init() {
  const p = await prefs();

  if (HOSTED_PAGE) {
    p.contract = DEFAULT_CONTRACT;
    p.mode = "futonly";
  }

  setLang(p.lang);
  document.documentElement.lang = p.lang;
  ui.el("lang").value = p.lang;

  // Dung select rong truoc, relabelControls do noi dung theo ngon ngu.
  ui.el("mode").innerHTML = ui.el("lookback").innerHTML = ui.el("tf").innerHTML = "";
  applyStaticI18n();
  ui.relabelControls();

  ui.el("mode").value = p.mode;
  ui.el("lookback").value = String(p.lookback);
  ui.el("tf").value = p.tf;
  ui.el("sourceUrl").value = p.sourceUrl || "";
  ui.el("token").value = p.token || "";
  ui.fillSelect("contract", [{ code: p.contract, name: p.contract }], p.contract);
  setAppToken(p.token);

  state.imported = await store.get(IMPORT_KEY, null);
  showImportState();

  const go = () => refresh().catch(showFatal);
  ui.el("reload").addEventListener("click", go);
  ui.el("saveToken").addEventListener("click", go);
  ui.el("saveSource").addEventListener("click", go);
  for (const id of ["contract", "mode", "lookback", "tf"]) {
    ui.el(id).addEventListener("change", go);
  }
  ui.el("lang").addEventListener("change", (e) => switchLang(e.target.value).catch(console.error));

  // Chan doan: mo dung URL dang goi trong mot tab thuong de xem server noi gi.
  ui.el("openInTab").addEventListener("click", () => {
    const q = currentPrefs();
    const ds = DATASETS[q.mode] ?? DATASETS.futonly;
    const url = `${CFTC_BASE}/${ds.tff}.json?cftc_contract_market_code=${encodeURIComponent(q.contract)}` +
      `&$select=${TFF_SELECT.join(",")}&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=3`;
    window.open(url, "_blank", "noopener");
  });

  ui.el("apply").addEventListener("click", () => {
    applyImportText(ui.el("manual").value).catch((e) => alert(e.message));
  });
  ui.el("file").addEventListener("change", async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try { await applyImportText(await f.text()); }
    catch (e) { alert(e.message); }
    ev.target.value = "";
  });
  ui.el("clearImport").addEventListener("click", async () => {
    state.imported = null;
    await store.set(IMPORT_KEY, null);
    ui.el("manual").value = "";
    showImportState();
    go();
  });

  // Danh sach hop dong chi tai KHI nguoi dung mo dropdown, khong chay luc khoi dong.
  ui.el("contract").addEventListener("mousedown", loadContractsOnce, { once: true });
  ui.el("contract").addEventListener("focus", loadContractsOnce, { once: true });
  if (HOSTED_PAGE) {
    ui.el("contract").disabled = true;
    ui.el("mode").disabled = true;
  }

  // Ve lai bieu do khi doi kich thuoc cua so (canvas scale theo DPR).
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (state.cot) render(); }, 200);
  });

  refresh({ useCache: true }).catch(showFatal);
}

async function loadContractsOnce() {
  if (state.contractsLoaded) return;
  state.contractsLoaded = true;
  const p = currentPrefs();
  try {
    const list = await listContracts(p.mode);
    if (!list.length) return;
    const has = list.some((i) => i.code === p.contract);
    ui.fillSelect("contract",
      has ? list : [{ code: p.contract, name: p.contract }, ...list], p.contract);
  } catch {
    state.contractsLoaded = false; // cho thu lai lan sau
  }
}

function showFatal(e) {
  console.error(e);
  ui.setStatus(t("st.error"), "red");
  state.lastAlerts = { errors: [{ raw: e.message || String(e) }], warnings: [], html: [] };
  ui.setAlerts(state.lastAlerts);
}

document.addEventListener("DOMContentLoaded", init);
