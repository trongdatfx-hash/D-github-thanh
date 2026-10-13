// Ve giao dien. Khong co logic tinh toan o day.

import { t, locale, shortDate, longDate } from "./i18n.js";
import { histogram, weekStart } from "./analytics.js";

const $ = (id) => document.getElementById(id);
export const el = $;

export const fmtInt = (x) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : Math.round(x).toLocaleString(locale());
export const fmtPct = (x, d = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : (x * 100).toFixed(d) + "%";
export const fmtSigned = (x, d = 2) =>
  !Number.isFinite(x) ? "—" : (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
export const fmtIdx = (x) => (x === null || x === undefined ? "—" : x.toFixed(0));
const cls = (x) => (x >= 0 ? "green" : "red");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const C = { green: "#39d18c", red: "#ff6976", grid: "#1c2c42", axis: "#91a4be", accent: "#347cf6" };

export function setStatus(text, kind = "muted") {
  const n = $("status");
  n.className = kind;
  n.textContent = text;
}

/**
 * Nhan MO TA canh bao ({k,p} hoac {raw}), khong nhan chuoi da dich san —
 * co the doi ngon ngu ma canh bao van dich theo.
 */
const resolveMsg = (d) =>
  d && typeof d === "object" && d.k ? t(d.k, d.p) : String(d?.raw ?? d ?? "");

export function setAlerts({ errors = [], warnings = [], html = [] }) {
  $("alerts").innerHTML =
    errors.map((e) => `<div class="err"><b>${t("err.label")}</b> ${esc(resolveMsg(e))}</div>`).join("") +
    html.map((h) => `<div class="vpn">${resolveMsg(h)}</div>`).join("") +
    warnings.map((w) => `<div class="warn">${esc(resolveMsg(w))}</div>`).join("");
}

function gauge(v) {
  if (v === null || v === undefined) return `<div class="gauge"></div>`;
  return `<div class="gauge"><b style="width:${v}%"></b><i style="left:calc(${v}% - 1px)"></i></div>`;
}

export function renderTop(sig, cot) {
  const rawAge = Math.floor((Date.now() - sig.current.date.getTime()) / 86400000);
  const age = rawAge < 0 ? t("top.future") : t("top.daysAgo", { n: rawAge });
  const cards = [
    [t("top.signal"), t("lbl." + sig.label),
      sig.label === "BULLISH" ? "green" : sig.label === "BEARISH" ? "red" : "yellow",
      t("sig.score", { s: sig.score })],
    [t("g.lf"), fmtIdx(sig.index.lf),
      sig.index.lf === null ? "" : sig.index.lf <= 20 ? "red" : sig.index.lf >= 80 ? "green" : "yellow",
      t("top.cotIndexNet", { v: fmtInt(sig.current.lfNet) })],
    [t("g.am"), fmtIdx(sig.index.am),
      sig.index.am === null ? "" : sig.index.am >= 80 ? "green" : sig.index.am <= 20 ? "red" : "yellow",
      t("top.cotIndexNet", { v: fmtInt(sig.current.amNet) })],
    [t("top.squeeze"), t("sq." + sig.squeeze),
      sig.squeeze === "HIGH" ? "red" : sig.squeeze === "MED" ? "yellow" : "green",
      t("top.report", { d: sig.current.iso, age })]
  ];
  $("top").innerHTML = cards
    .map(([ttl, v, c, sub]) =>
      `<div class="card"><div class="muted">${esc(ttl)}</div>
       <div class="metric ${c}">${esc(v)}</div>
       <div class="small">${esc(sub)}</div></div>`)
    .join("");
}

export function renderIndexTable(sig) {
  const rows = [
    [t("g.lf"), sig.index.lf, sig.z.lf],
    [t("g.am"), sig.index.am, sig.z.am],
    [t("g.dealer"), sig.index.dealer, sig.z.dealer],
    [t("g.nc"), sig.index.nc, sig.z.nc]
  ];
  $("idxTable").innerHTML =
    `<table><tr><th>${t("th.group")}</th><th>${t("th.cotIndex")}</th><th>${t("th.z")}</th><th style="width:38%">${t("th.pos")}</th></tr>` +
    rows.map(([n, v, z]) =>
      `<tr><td>${esc(n)}</td>
       <td class="${v === null ? "" : v >= 80 ? "green" : v <= 20 ? "red" : "yellow"}"><b>${fmtIdx(v)}</b></td>
       <td>${z === null || z === undefined ? "—" : z.toFixed(2)}</td>
       <td>${gauge(v)}</td></tr>`).join("") +
    `</table>`;
}

export function renderNetTable(sig) {
  const rows = [
    [t("g.lf"), sig.current.lfNet, sig.changes.lf],
    [t("g.am"), sig.current.amNet, sig.changes.am],
    [t("g.dealer"), sig.current.dealerNet, sig.changes.dealer],
    [t("g.nc"), sig.current.ncNet, sig.changes.nc]
  ];
  $("netTable").innerHTML =
    `<table><tr><th>${t("th.group")}</th><th>${t("th.netNow")}</th><th>${t("th.dWeek")}</th></tr>` +
    rows.map(([n, v, d]) =>
      `<tr><td>${esc(n)}</td>
       <td class="${v === null ? "" : cls(v)}">${fmtInt(v)}</td>
       <td class="${d === null ? "" : cls(d)}">${d === null ? "—" : (d >= 0 ? "+" : "") + fmtInt(d)}</td></tr>`).join("") +
    `<tr><td>${t("g.oi")}</td><td>${fmtInt(sig.current.oi)}</td><td>—</td></tr></table>`;
}

export function renderSignal(sig) {
  const color = sig.label === "BULLISH" ? "green" : sig.label === "BEARISH" ? "red" : "yellow";
  const priceText = sig.priceNote.k === "sig.noPrice"
    ? t("sig.noPrice")
    : t("sig.price4w", { r: fmtSigned(sig.priceNote.p.r4, 1), verdict: t(sig.priceNote.verdictKey) });

  $("signal").innerHTML =
    `<div class="metric ${color}">${t("lbl." + sig.label)}</div>
     <div style="margin:6px 0 12px"><b>${t("sig.score", { s: sig.score })}</b> · ${t("top.squeeze")} <b>${t("sq." + sig.squeeze)}</b>
     ${sig.confirmed === null ? "" : sig.confirmed
        ? ` · <span class="pill ok">${t("sig.confirmed")}</span>`
        : ` · <span class="pill bad">${t("sig.unconfirmed")}</span>`}</div>
     ${sig.notes.map((n) => `• ${esc(t(n.k, { ...n.p, v: fmtInt(n.p.v) }))}`).join("<br>")}
     <div style="margin-top:10px"><b>${t("sig.priceLabel")}</b> ${esc(priceText)}</div>
     <div class="small" style="margin-top:8px">${t("sig.disclaimer")}</div>`;
}

export function renderSPYStats(daily, weekly, source, shown, total) {
  const l = daily[daily.length - 1], p = daily[daily.length - 2] || l;
  const wk = weekly[weekly.length - 1];
  $("spyStats").innerHTML =
    `<div class="grid" style="margin-bottom:12px">
      <div><div class="muted">${t("spy.close")}</div><div class="metric">${l.c.toFixed(2)}</div><div class="small">${longDate(l.d)}</div></div>
      <div><div class="muted">${t("spy.day")}</div><div class="metric ${cls(l.c - p.c)}">${fmtPct(l.c / p.c - 1, 2)}</div></div>
      <div><div class="muted">${t("spy.week")}</div><div class="metric ${cls(wk.ret)}">${fmtPct(wk.ret, 2)}</div><div class="small">${t("spy.sessions", { n: wk.days })}</div></div>
      <div><div class="muted">${t("spy.range")}</div><div class="metric" style="font-size:18px">${wk.l.toFixed(2)}–${wk.h.toFixed(2)}</div></div>
    </div>`;
  $("chartNote").innerHTML =
    esc(t("spy.bars", { n: total ?? daily.length, src: source, shown }));
}

/** Bang tom tat dai bien do tuan — dat ngay duoi bieu do. */
export function renderRangeBox(box, model) {
  const n = $("wrbInfo");
  if (!box) {
    const why = model?.reason === "few"
      ? t("wrb.needMore", { have: model.have, need: model.need })
      : model?.reason === "fewOos"
      ? t("wrb.needOos", { have: model.have, need: model.need })
      : model?.reason === "singular" ? t("wrb.singular")
      : t("wrb.noData");
    n.innerHTML = `<div class="warn" style="margin:0">${esc(why)}</div>`;
    return;
  }

  const used = box.usedOfMedian;
  const zone = used === null ? "" : used >= 1 ? "over" : used >= 0.7 ? "near" : "inside";
  const zoneTxt = zone ? t("wrb.zone." + zone) : "";
  const zoneCls = zone === "over" ? "red" : zone === "near" ? "yellow" : "green";
  const r2 = box.r2oos;

  n.innerHTML =
    `<table style="margin-top:4px">
      <tr><th>${t("wrb.tier")}</th><th>${t("wrb.width")}</th><th>${t("wrb.low")}</th><th>${t("wrb.high")}</th></tr>
      ${[["25", box.r25, box.h25], ["50", box.r50, box.h50], ["90", box.r90, box.h90]]
        .map(([q, r, half]) =>
          `<tr><td>${t("wrb.pctile", { q })}</td>
           <td>${fmtPct(r, 2)}</td>
           <td class="red">${(box.open - half).toFixed(2)}</td>
           <td class="green">${(box.open + half).toFixed(2)}</td></tr>`).join("")}
     </table>
     <div style="margin-top:10px" class="small">
       <span class="pill ${zoneCls}">${esc(zoneTxt)}</span>
       ${used === null ? "" : esc(t("wrb.used", { p: fmtPct(used, 0) }))}
     </div>
     <div class="small" style="margin-top:6px">
       ${esc(t("wrb.quality", {
          r2: r2 === null || !Number.isFinite(r2) ? "—" : r2.toFixed(3),
          nres: box.nRes, nfit: box.nFit }))}
       ${r2 !== null && Number.isFinite(r2) && r2 <= 0
          ? ` <b class="red">${esc(t("wrb.r2bad"))}</b>` : ""}
     </div>
     <div class="small" style="margin-top:6px">${t("wrb.readme")}</div>`;
}

// ------------------------------------------------------------------ bieu do

function prepCanvas(id, cssHeight) {
  const cv = $(id);
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 1200;
  const h = cssHeight || cv.clientHeight || 300;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const x = cv.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  return { x, w, h };
}

let priceChart = null;
let candleSeries = null;
let rangePriceLines = [];
let chartData = [];
let rangeBox = null;
let chartDataKey = "";

function renderRangeBands() {
  const layer = $("rangeBands");
  if (!layer || !priceChart || !candleSeries) return;
  layer.innerHTML = "";
  if (!rangeBox || !chartData.length) return;

  let start = chartData.find((b) => b.week >= rangeBox.weekStartTs);
  if (!start) start = chartData[0];
  const xL = priceChart.timeScale().timeToCoordinate(start.time);
  const xR = Math.max(0, layer.clientWidth - 72);
  if (xL === null || xR <= xL) return;

  const tiers = [
    { half: rangeBox.h90, color: "#0ea5e9", label: "90%", fill: "rgba(56,189,248,.04)" },
    { half: rangeBox.h50, color: "#38bdf8", label: "50%", fill: "rgba(56,189,248,.06)" },
    { half: rangeBox.h25, color: "#7dd3fc", label: "25%", fill: "rgba(56,189,248,.08)" }
  ];
  for (const tier of tiers) {
    const top = candleSeries.priceToCoordinate(rangeBox.open + tier.half);
    const bottom = candleSeries.priceToCoordinate(rangeBox.open - tier.half);
    if (top === null || bottom === null) continue;
    const band = document.createElement("div");
    band.className = "rangeBand";
    band.style.cssText = `left:${xL}px;top:${top}px;width:${xR - xL}px;height:${Math.max(1, bottom - top)}px;border-color:${tier.color};background:${tier.fill}`;
    band.innerHTML = `<span style="color:${tier.color}">${tier.label}</span>`;
    layer.appendChild(band);
  }
  const yOpen = candleSeries.priceToCoordinate(rangeBox.open);
  if (yOpen !== null) {
    const line = document.createElement("div");
    line.className = "weekOpenLine";
    line.style.cssText = `left:${xL}px;top:${yOpen}px;width:${xR - xL}px`;
    layer.appendChild(line);
  }
}

function initPriceChart() {
  if (priceChart) return true;
  const L = window.LightweightCharts;
  const container = $("chart");
  if (!L?.createChart || !L?.CandlestickSeries) {
    container.innerHTML = `<div class="err">Không tải được TradingView Lightweight Charts.</div>`;
    return false;
  }
  priceChart = L.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: L.ColorType.Solid, color: "#091321" },
      textColor: C.axis,
      attributionLogo: true
    },
    grid: {
      vertLines: { color: "#13243a" },
      horzLines: { color: C.grid }
    },
    crosshair: { mode: L.CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#23364e", scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: "#23364e", rightOffset: 6, barSpacing: 7, minBarSpacing: 2 },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    localization: { locale: locale() }
  });
  candleSeries = priceChart.addSeries(L.CandlestickSeries, {
    upColor: C.green,
    downColor: C.red,
    borderVisible: false,
    wickUpColor: C.green,
    wickDownColor: C.red,
    priceFormat: { type: "price", precision: 2, minMove: 0.01 }
  });
  priceChart.subscribeCrosshairMove((param) => {
    const legend = $("chartLegend");
    const point = param.seriesData?.get(candleSeries);
    if (!point) return;
    const move = point.close - point.open;
    legend.innerHTML = `SPY&nbsp;&nbsp; O ${point.open.toFixed(2)} &nbsp; H ${point.high.toFixed(2)} &nbsp; L ${point.low.toFixed(2)} &nbsp; C <b style="color:${move >= 0 ? C.green : C.red}">${point.close.toFixed(2)}</b>`;
  });
  priceChart.timeScale().subscribeVisibleLogicalRangeChange(() => requestAnimationFrame(renderRangeBands));
  new ResizeObserver(() => {
    priceChart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    requestAnimationFrame(renderRangeBands);
  }).observe(container);
  return true;
}

/** Interactive SPY candles powered by TradingView Lightweight Charts. */
export function drawChart(bars, { intraday = false, box = null } = {}) {
  if (!initPriceChart()) return;
  const seen = new Set();
  chartData = bars
    .map((b) => ({
      time: Math.floor(b.d.getTime() / 1000),
      open: b.o, high: b.h, low: b.l, close: b.c,
      week: weekStart(b.d)
    }))
    .filter((b) => Number.isFinite(b.time) && !seen.has(b.time) && seen.add(b.time))
    .sort((a, b) => a.time - b.time);
  rangeBox = box;
  candleSeries.setData(chartData.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

  for (const line of rangePriceLines) candleSeries.removePriceLine(line);
  rangePriceLines = [];
  if (box) {
    const L = window.LightweightCharts;
    const defs = [
      [box.open + box.h90, "90% H", "#0ea5e9", L.LineStyle.Solid],
      [box.open + box.h50, "50% H", "#38bdf8", L.LineStyle.Dashed],
      [box.open + box.h25, "25% H", "#7dd3fc", L.LineStyle.Dotted],
      [box.open, "W Open", "#e2e8f0", L.LineStyle.Dashed],
      [box.open - box.h25, "25% L", "#7dd3fc", L.LineStyle.Dotted],
      [box.open - box.h50, "50% L", "#38bdf8", L.LineStyle.Dashed],
      [box.open - box.h90, "90% L", "#0ea5e9", L.LineStyle.Solid]
    ];
    rangePriceLines = defs.map(([price, title, color, lineStyle]) => candleSeries.createPriceLine({
      price, title, color, lineStyle, lineWidth: 1, axisLabelVisible: true
    }));
  }

  priceChart.applyOptions({
    localization: { locale: locale() },
    timeScale: { timeVisible: intraday, secondsVisible: false }
  });
  const key = `${chartData[0]?.time || 0}:${chartData.at(-1)?.time || 0}:${chartData.length}:${intraday}`;
  if (key !== chartDataKey) {
    chartDataKey = key;
    priceChart.timeScale().fitContent();
  }
  const last = chartData.at(-1);
  if (last) {
    const move = last.close - last.open;
    $("chartLegend").innerHTML = `SPY&nbsp;&nbsp; O ${last.open.toFixed(2)} &nbsp; H ${last.high.toFixed(2)} &nbsp; L ${last.low.toFixed(2)} &nbsp; C <b style="color:${move >= 0 ? C.green : C.red}">${last.close.toFixed(2)}</b>`;
  }
  requestAnimationFrame(renderRangeBands);
}

/**
 * Bieu do cot: phan bo loi suat tuan cho TUAN KE TIEP, ghi ro ngay/thang.
 * Cot xanh = tuan dong cua tren gia mo cua.
 */
export function renderForecast(res) {
  const win = res.nextWeek;
  const useCond = res.reliable && res.condReturns?.length >= 30;
  const returns = useCond ? res.condReturns : res.baseReturns;
  const stat = useCond ? res.conditional : res.base;

  const rangeText = win
    ? t("fc.weekOf", { from: longDate(win.monday), to: longDate(win.friday) })
    : "";
  $("fcTitle").textContent = t("fc.title", { range: rangeText });
  $("fcSub").textContent = returns?.length
    ? (useCond ? t("fc.sub", { n: returns.length }) : t("fc.subBase", { n: returns.length }))
    : "";

  const hist = histogram(returns || [], { bins: 16 });
  if (!hist || !stat) {
    $("fcLegend").innerHTML = "";
    $("fcNote").textContent = t("fc.noData");
    const { x, w, h } = prepCanvas("fcChart");
    x.fillStyle = C.axis; x.font = "12px system-ui, Arial";
    x.fillText(t("fc.noData"), 12, h / 2);
    return;
  }

  $("fcLegend").innerHTML =
    `<span class="pill" style="border-color:#1f5c42;color:${C.green}">${t("fc.green", { p: fmtPct(stat.pGreen) })}</span>
     <span class="pill" style="border-color:#6b2730;color:${C.red}">${t("fc.red", { p: fmtPct(1 - stat.pGreen) })}</span>
     <span class="pill">${t("fc.median", { v: fmtSigned(stat.p50) })}</span>
     <span class="pill">${t("fc.range", { lo: fmtSigned(stat.p10), hi: fmtSigned(stat.p90) })}</span>`;
  $("fcNote").textContent = t("fc.caution");

  const { x, w, h } = prepCanvas("fcChart");
  const padL = 46, padR = 12, padT = 14, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const X = (v) => padL + ((v - hist.lo) / (hist.hi - hist.lo)) * plotW;
  const maxS = hist.maxShare || 1;
  const Y = (s) => padT + plotH * (1 - s / maxS);

  // luoi ngang + nhan truc Y (ti le mau)
  x.font = "10px system-ui, Arial";
  for (let i = 0; i <= 4; i++) {
    const s = (maxS * i) / 4, y = Y(s);
    x.strokeStyle = C.grid; x.lineWidth = 1;
    x.beginPath(); x.moveTo(padL, y); x.lineTo(padL + plotW, y); x.stroke();
    x.fillStyle = C.axis;
    const lab = (s * 100).toFixed(0) + "%";
    x.fillText(lab, padL - 6 - x.measureText(lab).width, y + 3);
  }

  // cot
  const bw = (plotW / hist.bars.length) * 0.84;
  for (const b of hist.bars) {
    if (!b.count) continue;
    const cx = X(b.mid);
    const y = Y(b.share);
    x.fillStyle = b.mid >= 0 ? C.green : C.red;
    x.globalAlpha = 0.85;
    x.fillRect(cx - bw / 2, y, bw, padT + plotH - y);
    x.globalAlpha = 1;
  }

  // duong 0 (ranh gioi xanh/do)
  const x0 = X(0);
  x.strokeStyle = "#c3d2e8"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(x0, padT); x.lineTo(x0, padT + plotH); x.stroke();

  // trung vi
  const xm = X(Math.max(hist.lo, Math.min(hist.hi, stat.p50)));
  x.strokeStyle = C.accent; x.lineWidth = 2; x.setLineDash([4, 3]);
  x.beginPath(); x.moveTo(xm, padT); x.lineTo(xm, padT + plotH); x.stroke();
  x.setLineDash([]);

  // truc X: nhan phan tram
  x.fillStyle = C.axis; x.font = "10px system-ui, Arial";
  for (let i = 0; i <= 6; i++) {
    const v = hist.lo + ((hist.hi - hist.lo) * i) / 6;
    const lab = (v * 100).toFixed(1) + "%";
    const tw = x.measureText(lab).width;
    x.fillText(lab, Math.min(Math.max(padL, X(v) - tw / 2), padL + plotW - tw), h - 18);
  }
  x.fillStyle = "#c3d2e8";
  const axisLab = t("fc.axisX");
  x.fillText(axisLab, padL + plotW / 2 - x.measureText(axisLab).width / 2, h - 4);
}

export function renderProb(res) {
  const box = (title, b, note) => {
    if (!b) return `<div class="muted">${t("prob.noData", { title })}</div>`;
    return `<div style="margin-bottom:14px">
      <div class="muted">${esc(t("prob.n", { title, n: b.n }))}</div>
      <div class="metric ${b.pGreen >= 0.5 ? "green" : "red"}">${t("prob.green", { p: fmtPct(b.pGreen) })}</div>
      <div class="bar"><i style="width:${(b.pGreen * 100).toFixed(1)}%"></i></div>
      <div class="small">${t("prob.ci", { lo: fmtPct(b.ci[0]), hi: fmtPct(b.ci[1]) })}</div>
      <table style="margin-top:6px">
        <tr><td>${t("prob.p10")}</td><td>${fmtPct(b.p10, 2)}</td></tr>
        <tr><td>${t("prob.p50")}</td><td>${fmtPct(b.p50, 2)}</td></tr>
        <tr><td>${t("prob.p90")}</td><td>${fmtPct(b.p90, 2)}</td></tr>
      </table>
      ${note ? `<div class="small" style="margin-top:5px">${esc(note)}</div>` : ""}
    </div>`;
  };

  const cond = res.conditional;
  const bucketTxt = res.bucketKey ? t(res.bucketKey) : t("prob.none");
  const edge = cond && res.base ? cond.pGreen - res.base.pGreen : null;

  let verdict = "";
  if (cond && res.base) {
    const inside = cond.pGreen >= res.base.ci[0] && cond.pGreen <= res.base.ci[1];
    verdict = inside
      ? `<div class="warn" style="margin-top:8px">${t("prob.inside", {
          p: fmtPct(cond.pGreen), lo: fmtPct(res.base.ci[0]), hi: fmtPct(res.base.ci[1]) })}</div>`
      : `<div class="small" style="margin-top:8px"><span class="pill ok">${t("prob.outside")}</span> ${t("prob.outsideNote")}</div>`;
  }

  $("prob").innerHTML =
    box(t("prob.cond", { b: bucketTxt }), cond, res.reliable ? null : t("prob.small")) +
    box(t("prob.base"), res.base) +
    (edge === null ? "" :
      `<div class="small">${t("prob.edge", { v: (edge * 100 >= 0 ? "+" : "") + (edge * 100).toFixed(1) })}</div>`) +
    verdict +
    `<div class="small" style="margin-top:8px">${t("prob.method")}</div>`;
}

export function renderMatrix(sig, res) {
  const lines = [
    sig.index.lf !== null && sig.index.lf <= 25 ? t("mx.lfLow")
      : sig.index.lf !== null && sig.index.lf >= 75 ? t("mx.lfHigh")
      : t("mx.lfMid"),
    sig.confirmed === false ? t("mx.unconfirmed") : t("mx.aligned"),
    res.reliable ? t("mx.enough", { n: res.conditional.n }) : t("mx.tooFew"),
    t("mx.am"),
    t("mx.lag"),
    t("mx.ownTest")
  ];
  $("matrix").innerHTML = lines.map((l) => "• " + l).join("<br>");
}

export function renderDiag(cot, priceInfo, res, extra = {}) {
  const bad = cot.fieldReport.filter((f) => !f.ok);
  const fieldHtml = bad.length
    ? `<div class="err">${esc(t("diag.unmapped", { n: bad.length, list: bad.map((f) => f.wanted).join(", ") }))}</div>`
    : `<div><span class="pill ok">${t("diag.mapped", { n: cot.fieldReport.length })}</span></div>`;

  const attempts = (priceInfo.attempts || [])
    .map((a) => `<tr><td>${esc(a.name)}</td><td>${a.ok ? `<span class="pill ok">${t("diag.ok")}</span>` : `<span class="pill bad">${t("diag.bad")}</span>`}</td><td class="small" style="text-align:left">${esc(a.error || "")}</td></tr>`)
    .join("");

  const src = extra.source || cot.source || "cftc";

  $("diag").innerHTML = fieldHtml +
    `<table style="margin-top:10px">
      <tr><th>${t("th.item")}</th><th>${t("th.value")}</th><th style="text-align:left">${t("th.note")}</th></tr>
      <tr><td>${t("diag.contract")}</td><td>${esc(cot.contractName)}</td><td class="small" style="text-align:left">${esc(cot.contract)} · ${esc(cot.mode)}</td></tr>
      <tr><td>${t("diag.weeks")}</td><td>${cot.rows.length}</td><td class="small" style="text-align:left">${esc(cot.rows[0].iso)} → ${esc(cot.rows[cot.rows.length - 1].iso)}</td></tr>
      <tr><td>${t("diag.cotSource")}</td><td>${esc(src)}</td><td class="small" style="text-align:left"></td></tr>
      <tr><td>${t("diag.strategy")}</td><td>${esc(cot.strategy?.tff || "—")}</td><td class="small" style="text-align:left">Legacy: ${esc(cot.strategy?.legacy || "—")}</td></tr>
      <tr><td>${t("diag.token")}</td><td>${cot.tokenUsed ? `<span class="pill ok">${t("diag.tokenYes")}</span>` : `<span class="pill">${t("diag.tokenNo")}</span>`}</td><td class="small" style="text-align:left">${cot.tokenUsed ? t("diag.tokenYesNote") : t("diag.tokenNoNote")}</td></tr>
      <tr><td>${t("diag.priceSource")}</td><td>${esc(priceInfo.source)}</td><td class="small" style="text-align:left">${t("diag.bars", { n: priceInfo.bars || 0 })}</td></tr>
     </table>
     <div class="muted" style="margin:12px 0 4px">${t("diag.priceTried")}</div>
     <table><tr><th>${t("th.source")}</th><th>${t("th.result")}</th><th style="text-align:left">${t("th.detail")}</th></tr>
       ${attempts || `<tr><td colspan="3" class="small">${t("diag.none")}</td></tr>`}
     </table>
     <details style="margin-top:10px"><summary>${t("diag.fieldDetail")}</summary>
      <table style="margin-top:8px"><tr><th>${t("th.group")}</th><th style="text-align:left">${t("diag.expected")}</th><th style="text-align:left">${t("diag.matchedWith")}</th></tr>` +
      cot.fieldReport.map((f) =>
        `<tr><td>${esc(f.group)}</td><td style="text-align:left" class="small">${esc(f.wanted)}</td>
         <td style="text-align:left" class="small ${f.ok ? "" : "red"}">${esc(f.matched || t("diag.noMatch"))}</td></tr>`).join("") +
      `</table></details>`;
}

export function fillSelect(id, items, value) {
  const s = $(id);
  s.innerHTML = items.map((i) => `<option value="${esc(i.code)}">${esc(i.name)}</option>`).join("");
  if (value) s.value = value;
}

/** Cac option co text dong theo ngon ngu. */
export function relabelControls() {
  const set = (id, pairs) => {
    const s = $(id);
    const keep = s.value;
    s.innerHTML = pairs.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join("");
    s.value = keep || pairs[0][0];
  };
  set("mode", [["futonly", t("ctl.futonly")], ["combined", t("ctl.combined")]]);
  set("lookback", [156, 260, 520].map((n) => [String(n), t("ctl.lookback", { n })]));
  set("tf", [["m30", t("ctl.tf.m30")], ["d1", t("ctl.tf.d1")]]);
  $("reload").textContent = t("ctl.reload");
}
