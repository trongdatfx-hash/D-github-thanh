// Tang phan tich. Thay he so tuy tien "/50000000" cua ban v2 bang
// COT Index (Williams), z-score va bootstrap CO DIEU KIEN tinh tu du lieu that.

// ---------------------------------------------------------------- tien ich

/** RNG co seed -> chay lai ra cung ket qua. Thong ke ma doi so moi lan bam la vo dung. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function quantile(sorted, t) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * t;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Khoang tin cay Wilson cho ty le — trung thuc hon "62.4%" tran trui. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

// ------------------------------------------------------------ nen theo tuan

/** Moc thu Hai (UTC) cua tuan chua ngay d. */
export function weekStart(d) {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(t).getUTCDay();      // 0 = CN
  const offset = (dow + 6) % 7;             // thu Hai = 0
  return t - offset * 86400000;
}

/**
 * Gop nen ngay thanh nen tuan. Ban v2 chia tuan bang
 * floor((d - 1/1)/604800000) nen ranh gioi tuan troi dan qua moi nam.
 */
export function weeklyBars(daily) {
  const buckets = new Map();
  for (const b of daily) {
    const k = weekStart(b.d);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startTs, days]) => ({
      startTs,
      start: new Date(startTs),
      end: days[days.length - 1].d,
      days: days.length,
      o: days[0].o,
      h: Math.max(...days.map((x) => x.h)),
      l: Math.min(...days.map((x) => x.l)),
      c: days[days.length - 1].c,
      ret: days[days.length - 1].c / days[0].o - 1
    }));
}

// --------------------------------------------------------------- COT Index

/**
 * COT Index kieu Williams, tinh TRUOT va khong nhin truoc:
 * gia tri tai i chi dung du lieu [i-window+1 .. i].
 * 0 = day cua bien do window tuan, 100 = dinh.
 */
export function rollingCotIndex(values, window = 156) {
  return values.map((v, i) => {
    if (v === null || i < Math.min(window, 26) - 1) return null;
    const w = values.slice(Math.max(0, i - window + 1), i + 1).filter((x) => x !== null);
    if (w.length < 26) return null;
    const lo = Math.min(...w), hi = Math.max(...w);
    return hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
}

export function rollingZ(values, window = 156) {
  return values.map((v, i) => {
    if (v === null || i < 26) return null;
    const w = values.slice(Math.max(0, i - window + 1), i + 1).filter((x) => x !== null);
    if (w.length < 26) return null;
    const s = stdev(w);
    return s === 0 ? 0 : (v - mean(w)) / s;
  });
}

// ------------------------------------------------- gan COT voi tuan giao dich

/**
 * COT chot ngay thu Ba, cong bo thu Sau 15:30 ET. Vay tuan dau tien co the
 * giao dich duoc bang thong tin do la tuan bat dau thu Hai KE TIEP.
 * Gan sai cho nay se tao lookahead bias va lam moi xac suat dep gia tao.
 */
export function attachNextWeek(cotRows, bars) {
  const sorted = [...bars].sort((a, b) => a.startTs - b.startTs);
  return cotRows.map((row) => {
    const releaseTs = row.date.getTime() + 3 * 86400000; // thu Ba -> thu Sau
    const next = sorted.find((b) => b.startTs > releaseTs);
    return { ...row, nextWeek: next || null };
  });
}

// -------------------------------------------------------------- bootstrap

export function bootstrap(returns, { paths = 20000, seed = 42 } = {}) {
  if (!returns.length) return null;
  const rnd = mulberry32(seed);
  const draws = new Array(paths);
  let green = 0;
  for (let i = 0; i < paths; i++) {
    const r = returns[Math.floor(rnd() * returns.length)];
    draws[i] = r;
    if (r > 0) green++;
  }
  draws.sort((a, b) => a - b);

  const k = returns.filter((r) => r > 0).length;
  const [lo, hi] = wilson(k, returns.length);

  return {
    n: returns.length,
    pGreen: green / paths,
    ci: [lo, hi],                       // CI dua tren n THAT, khong phai 20k duong gia lap
    p10: quantile(draws, 0.1),
    p50: quantile(draws, 0.5),
    p90: quantile(draws, 0.9),
    mean: mean(draws)
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MO HINH BIEN DO TUAN (HAR) — cung giao thuc voi Weekly Range Box tren Pine
//
//  Dac trung, tat ca deu biet TRUOC khi tuan mo cua (khong nhin truoc):
//    d5 / d22 / d66 = trung binh log bien do NGAY tren 5 / 22 / 66 phien
//                     da dong cua TRUOC ngay mo tuan
//  Muc tieu: log( (high tuan - low tuan) / open tuan )
//            = log cua BIEN DO THEO TI LE, khong phai log(high/low).
//  Phan biet nay quan trong: exp(mu) phai ra thang ti le (~0.025 = 2,5%) de
//  cong thuc hop cua Pine (open × exp(mu+q) / 2) cho ra chieu cao dung. Neu
//  dung log(high/low) thi exp(mu) ~ 1.025 va hop se rong bang nua gia tri gia.
//
//  Phan vi lay tu PHAN DU NGOAI MAU (walk-forward mot buoc toi), khong phai
//  phan du trong mau. Phan du trong mau luon dep hon thuc te — dung no de ve
//  hop la tu lua minh.
// ══════════════════════════════════════════════════════════════════════════════

/** Giai he A·b = c bang khu Gauss co chon truc. A phang theo hang, kich thuoc k×k. */
export function solveLinear(XtX, Xty, k) {
  const A = Array.from(XtX), c = Array.from(Xty);
  for (let col = 0; col < k; col++) {
    let piv = col, best = Math.abs(A[col * k + col]);
    for (let r = col + 1; r < k; r++) {
      const v = Math.abs(A[r * k + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-11) return null;              // ma tran suy bien
    if (piv !== col) {
      for (let j = 0; j < k; j++) {
        const t = A[col * k + j]; A[col * k + j] = A[piv * k + j]; A[piv * k + j] = t;
      }
      const t = c[col]; c[col] = c[piv]; c[piv] = t;
    }
    const d = A[col * k + col];
    for (let j = col; j < k; j++) A[col * k + j] /= d;
    c[col] /= d;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = A[r * k + col];
      if (f === 0) continue;
      for (let j = col; j < k; j++) A[r * k + j] -= f * A[col * k + j];
      c[r] -= f * c[col];
    }
  }
  return c;
}

const dot = (b, x) => b.reduce((s, v, i) => s + v * x[i], 0);

/**
 * Dung dac trung HAR cho tung nen tuan.
 * @returns [{ week, x:[1,d5,d22,d66], y }] — chi giu tuan du dac trung.
 */
export function harSamples(daily, weekly) {
  if (!daily?.length || !weekly?.length) return [];
  const lr = daily.map((b) =>
    b.h > 0 && b.l > 0 ? Math.log(b.h / b.l) : 0);
  const pre = [0];
  for (const v of lr) pre.push(pre[pre.length - 1] + v);
  const meanLast = (p, n) => (p >= n ? (pre[p] - pre[p - n]) / n : null);

  const out = [];
  let p = 0; // so phien da dong cua TRUOC moc tuan dang xet
  for (const w of weekly) {
    while (p < daily.length && daily[p].d.getTime() < w.startTs) p++;
    const d5 = meanLast(p, 5), d22 = meanLast(p, 22), d66 = meanLast(p, 66);
    if (d5 === null || d22 === null || d66 === null) continue;
    const span = w.h - w.l;
    const y = span > 0 && w.o > 0 ? Math.log(span / w.o) : null;
    if (y === null || !Number.isFinite(y)) continue;
    out.push({ week: w, x: [1, d5, d22, d66], y });
  }
  return out;
}

/**
 * Walk-forward mot buoc toi: moi tuan chi hoc tu cac tuan TRUOC no.
 *
 * @returns null neu khong du mau, hoac:
 *  { mu, q10,q25,q50,q90, r2oos, nFit, nRes, coef, sampleWeek }
 *  mu = du bao log-bien-do cho tuan HIEN TAI (dac trung chot luc tuan mo cua).
 */
export function weeklyRangeModel(daily, weekly, { minTrain = 60 } = {}) {
  const K = 4;
  const s = harSamples(daily, weekly);
  if (s.length < minTrain + 10) {
    return { ok: false, reason: "few", have: s.length, need: minTrain + 10 };
  }

  // Tuan cuoi dang chay -> khong dung de HOC (bien do chua chot), nhung van du
  // bao duoc vi dac trung cua no da co tu luc tuan mo cua.
  const train = s.slice(0, -1);
  const current = s[s.length - 1];

  const XtX = new Array(K * K).fill(0), Xty = new Array(K).fill(0);
  let sumY = 0, n = 0;
  const res = [];
  let sseModel = 0, sseBench = 0;

  for (let i = 0; i < train.length; i++) {
    const { x, y } = train[i];
    // --- du bao TRUOC khi nap quan sat nay vao mo hinh ---
    if (n >= minTrain) {
      const b = solveLinear(XtX, Xty, K);
      if (b) {
        const pred = dot(b, x);
        if (Number.isFinite(pred)) {
          res.push(y - pred);
          sseModel += (y - pred) ** 2;
          sseBench += (y - sumY / n) ** 2;   // moc so sanh: trung binh cua qua khu
        }
      }
    }
    // --- roi moi nap ---
    for (let a = 0; a < K; a++) {
      Xty[a] += x[a] * y;
      for (let b2 = 0; b2 < K; b2++) XtX[a * K + b2] += x[a] * x[b2];
    }
    sumY += y; n++;
  }

  if (res.length < 20) {
    return { ok: false, reason: "fewOos", have: res.length, need: 20 };
  }

  const coef = solveLinear(XtX, Xty, K);
  if (!coef) return { ok: false, reason: "singular" };

  const mu = dot(coef, current.x);
  if (!Number.isFinite(mu)) return { ok: false, reason: "singular" };

  const sorted = [...res].sort((a, b) => a - b);
  return {
    ok: true,
    mu,
    q10: quantile(sorted, 0.10),
    q25: quantile(sorted, 0.25),
    q50: quantile(sorted, 0.50),
    q90: quantile(sorted, 0.90),
    // R² ngoai mau kieu Campbell–Thompson: am nghia la thua trung binh don gian.
    r2oos: sseBench > 0 ? 1 - sseModel / sseBench : null,
    nFit: n,
    nRes: res.length,
    coef,
    week: current.week
  };
}

/**
 * Doi mo hinh thanh hop de ve: tam = gia mo tuan, nua chieu cao = open × r / 2
 * (dung cong thuc cua Weekly Range Box tren Pine).
 */
export function rangeBoxFrom(model, week) {
  if (!model?.ok || !week) return null;
  const open = week.o;
  const r = (q) => Math.exp(model.mu + q);
  const mk = (q) => open * r(q) / 2;
  const travelled = week.h > 0 && week.l > 0 ? week.h - week.l : 0;
  return {
    open,
    weekStartTs: week.startTs,
    h25: mk(model.q25), h50: mk(model.q50), h90: mk(model.q90),
    r25: r(model.q25), r50: r(model.q50), r90: r(model.q90),
    // Da di duoc bao nhieu phan cua bien do du bao trung vi.
    travelled,
    usedOfMedian: open * r(model.q50) > 0 ? travelled / (open * r(model.q50)) : null,
    r2oos: model.r2oos,
    nRes: model.nRes,
    nFit: model.nFit
  };
}

/**
 * Tuan giao dich KE TIEP sau nen tuan cuoi cung — chinh la tuan dang duoc du doan.
 * Tra ve moc thu Hai va thu Sau (UTC) de hien ro ngay/thang tren bieu do.
 */
export function nextWeekWindow(bars) {
  if (!bars?.length) return null;
  const lastStart = bars[bars.length - 1].startTs;
  const monday = lastStart + 7 * 86400000;
  return {
    monday: new Date(monday),
    friday: new Date(monday + 4 * 86400000),
    startTs: monday
  };
}

/**
 * Chia chuoi loi suat thanh cot histogram de ve. Bien duoc cat o phan vi 2/98
 * cho khoi bi mot vai tuan cuc doan keo det ca bieu do.
 */
export function histogram(returns, { bins = 16 } = {}) {
  if (!returns || returns.length < 3) return null;
  // Ep so cot CHAN: cong voi bien doi xung quanh 0, moc 0 se roi dung vao ranh
  // gioi cot. Neu de so le, cot giua vat qua 0 va bi to mot mau duy nhat —
  // nhin ra ve tuan xanh/do nhieu hon thuc te.
  if (bins % 2) bins += 1;
  const sorted = [...returns].sort((a, b) => a - b);
  let lo = quantile(sorted, 0.02), hi = quantile(sorted, 0.98);
  if (!(hi > lo)) { lo = sorted[0] - 0.005; hi = sorted[sorted.length - 1] + 0.005; }
  // Ep bien doi xung quanh 0 de mat khong bi danh lua ve phia xanh/do.
  const half = Math.max(Math.abs(lo), Math.abs(hi));
  lo = -half; hi = half;

  const width = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const r of returns) {
    let i = Math.floor((r - lo) / width);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    counts[i]++;
  }
  const n = returns.length;
  return {
    lo, hi, width, n,
    bars: counts.map((c, i) => ({
      from: lo + i * width,
      to: lo + (i + 1) * width,
      mid: lo + (i + 0.5) * width,
      count: c,
      share: c / n
    })),
    maxShare: Math.max(...counts) / n
  };
}

export const QUINTILES = [
  { lo: 0,  hi: 20,  label: "0–20 (cuc thap)" },
  { lo: 20, hi: 40,  label: "20–40 (thap)" },
  { lo: 40, hi: 60,  label: "40–60 (trung binh)" },
  { lo: 60, hi: 80,  label: "60–80 (cao)" },
  { lo: 80, hi: 100, label: "80–100 (cuc cao)" }
];

export const quintileOf = (v) =>
  v === null || v === undefined
    ? null
    : QUINTILES.findIndex((q) => v >= q.lo && (v < q.hi || q.hi === 100));

/**
 * Xac suat nen tuan CO DIEU KIEN: chi lay nhung tuan trong qua khu ma
 * COT Index cua nhom dang xet nam cung ngu phan voi hien tai.
 */
export function conditionalWeekly(cotRows, bars, groupKey, { window = 156, paths = 20000 } = {}) {
  const values = cotRows.map((r) => r[groupKey]);
  const idx = rollingCotIndex(values, window);
  const withIdx = cotRows.map((r, i) => ({ ...r, cotIdx: idx[i] }));
  const linked = attachNextWeek(withIdx, bars);

  const current = idx[idx.length - 1];
  const bucket = quintileOf(current);

  const closed = bars.slice(0, -1);               // bo tuan dang chay
  const closedIds = new Set(closed.map((b) => b.startTs));

  const usable = linked.filter(
    (r) => r.nextWeek && closedIds.has(r.nextWeek.startTs) && r.cotIdx !== null
  );

  const baseReturns = closed.map((b) => b.ret).filter(Number.isFinite);
  const condReturns = usable
    .filter((r) => quintileOf(r.cotIdx) === bucket)
    .map((r) => r.nextWeek.ret)
    .filter(Number.isFinite);

  return {
    currentIndex: current,
    bucket,
    bucketKey: bucket === null ? null : `q.${bucket}`,
    bucketLabel: bucket === null ? "—" : QUINTILES[bucket].label,
    base: bootstrap(baseReturns, { paths, seed: 42 }),
    conditional: bootstrap(condReturns, { paths, seed: 7 }),
    baseReturns,
    condReturns,
    nextWeek: nextWeekWindow(bars),
    // Duoi 30 mau thi con so chi de tham khao, khong dung de vao lenh.
    reliable: condReturns.length >= 30
  };
}
