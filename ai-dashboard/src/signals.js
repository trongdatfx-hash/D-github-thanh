// Bo luat doc COT.
//
// Sua mot loi doc quan trong cua ban v2: no cham -18 diem vi "Leveraged Funds
// net short lon". Nhung Leveraged Funds LUON net short E-mini S&P 500 — ho la
// doi ung cua Asset Manager trong giao dich co so (cash-futures basis).
// Net short tuyet doi khong phai tin hieu giam gia; chi co do lech so voi
// LICH SU CUA CHINH NHOM DO moi co y nghia. Vi vay moi thang diem o day
// deu dua tren COT Index (0–100) chu khong dua tren dau cua so tuyet doi.
//
// Ghi chu tra ve dang {k, p} (key + params) de tang UI dich sang vi/en.

import { rollingCotIndex, rollingZ } from "./analytics.js";

const last = (a) => (a.length ? a[a.length - 1] : null);

/** Chuyen COT Index 0–100 thanh diem -25..+25 quanh moc 50. */
const tilt = (idx, weight) => (idx === null ? 0 : ((idx - 50) / 50) * weight);

const round = (x) => Math.round(x);

export function buildSignals(cot, weekly, { window = 156 } = {}) {
  const rows = cot.rows;
  const series = (k) => rows.map((r) => r[k]);

  const idx = {
    lf:     rollingCotIndex(series("lfNet"), window),
    am:     rollingCotIndex(series("amNet"), window),
    dealer: rollingCotIndex(series("dealerNet"), window),
    nc:     rollingCotIndex(series("ncNet"), window)
  };
  const z = {
    lf:     rollingZ(series("lfNet"), window),
    am:     rollingZ(series("amNet"), window),
    dealer: rollingZ(series("dealerNet"), window),
    nc:     rollingZ(series("ncNet"), window)
  };

  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2] || cur;
  const now = {
    lf: last(idx.lf), am: last(idx.am), dealer: last(idx.dealer), nc: last(idx.nc)
  };
  const zNow = { lf: last(z.lf), am: last(z.am), dealer: last(z.dealer), nc: last(z.nc) };

  const notes = [];
  let score = 0;

  // 1. Vi the tuong doi so voi lich su cua chinh nhom do.
  score += tilt(now.lf, 22);
  if (now.lf !== null) {
    notes.push(
      now.lf <= 20 ? { k: "n.lfLow",  p: { w: window, i: now.lf.toFixed(0) } }
    : now.lf >= 80 ? { k: "n.lfHigh", p: { w: window, i: now.lf.toFixed(0) } }
                   : { k: "n.lfMid",  p: { i: now.lf.toFixed(0) } }
    );
  }

  score += tilt(now.am, 20);
  if (now.am !== null) {
    notes.push(
      now.am >= 80 ? { k: "n.amHigh", p: { i: now.am.toFixed(0) } }
    : now.am <= 20 ? { k: "n.amLow",  p: { i: now.am.toFixed(0) } }
                   : { k: "n.amMid",  p: { i: now.am.toFixed(0) } }
    );
  }

  if (now.nc !== null) {
    score += tilt(now.nc, 12);
    notes.push({ k: "n.nc", p: { i: now.nc.toFixed(0) } });
  }

  // 2. Dong luong tuan qua tuan.
  const dLf = cur.lfNet - prev.lfNet;
  const dAm = cur.amNet - prev.amNet;
  if (dLf > 0) { score += 8; notes.push({ k: "n.lfUp",   p: { v: round(dLf) } }); }
  else if (dLf < 0) { score -= 8; notes.push({ k: "n.lfDown", p: { v: round(dLf) } }); }
  if (dAm < 0) { score -= 5; notes.push({ k: "n.amDown", p: { v: round(dAm) } }); }
  else if (dAm > 0) { score += 5; }

  // 3. Xac nhan bang gia — vi the khong xac nhan boi gia thi chua dung de vao lenh.
  let priceNote = { k: "sig.noPrice", p: {} };
  let confirmed = null;
  const closed = weekly?.slice(0, -1) || [];
  if (closed.length >= 4) {
    const r4 = closed.slice(-4).reduce((s, b) => s + b.ret, 0);
    confirmed = Math.sign(r4) === Math.sign(score) || score === 0;
    priceNote = { k: "sig.price4w", p: { r4 }, verdictKey: confirmed ? "sig.priceAligned" : "sig.priceAgainst" };
    score += Math.sign(r4) * 6;
  }

  // 4. Rui ro squeeze: short dong duc + gia van len.
  const upTrend = closed.length >= 4 && closed.slice(-4).reduce((s, b) => s + b.ret, 0) > 0;
  const squeeze = now.lf !== null && now.lf <= 25 && upTrend ? "HIGH"
                : now.lf !== null && now.lf <= 40 && upTrend ? "MED"
                : "LOW";

  const label = score >= 20 ? "BULLISH" : score <= -20 ? "BEARISH" : "NEUTRAL";

  return {
    score: Math.round(score),
    label,
    squeeze,
    notes,
    priceNote,
    confirmed,
    index: now,
    z: zNow,
    changes: { lf: dLf, am: dAm, dealer: cur.dealerNet - prev.dealerNet,
               nc: cur.ncNet !== null && prev.ncNet !== null ? cur.ncNet - prev.ncNet : null },
    current: cur,
    previous: prev,
    series: idx
  };
}
