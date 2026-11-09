const M15 = 900_000;
const H1 = 4 * M15;
const freshOiMs = 15_000;

export function m15FlowWindow(rows, sourceTime) {
  const last = rows.findLastIndex(b => b.t <= sourceTime && b.sourceComplete !== false);
  if (last < 0) return null;
  const tail = rows[last], start = Math.floor(tail.t / H1) * H1;
  const recent = rows.slice(Math.max(0, last - 83), last + 1);
  const bars = recent.filter(b => b.t >= start && b.sourceComplete !== false);
  const contiguous = bars.length === (tail.t - start) / M15 + 1 &&
    bars.every((b, i) => b.t === start + i * M15 && b.end === b.t + M15 - 1);
  const live = sourceTime <= tail.end;
  return {start, bars, recent, contiguous, live, sourceTime, cutoff: live ? tail.t : tail.end + 1};
}

function takerFlow(bars) {
  if (bars.some(b => !Number.isFinite(b.q) || !Number.isFinite(b.buy) || b.q < 0 || b.buy < 0 || b.buy > b.q)) return null;
  const total = bars.reduce((s, b) => s + b.q, 0);
  const buy = bars.reduce((s, b) => s + b.buy, 0);
  const net = 2 * buy - total;
  return total > 0 ? {buy, sell: total - buy, net, ratio: net / total} : null;
}

function oiFlow(window, samples, receipts, liveOi, now) {
  const points = [window.start - M15, ...window.bars.map(b => b.t)].map(t => samples.get(t)?.oi);
  const latest = window.live ? liveOi : null;
  if (window.live) {
    const tail = window.bars.at(-1);
    if (!latest || latest.time < tail.t || latest.time > tail.end || now - latest.time > freshOiMs) return null;
    points[points.length - 1] = latest.oi;
  }
  if (points.some(x => !Number.isFinite(x) || x <= 0)) return null;
  const deltas = points.slice(1).map((x, i) => 100 * Math.log(x / points[i]));
  const increase = deltas.reduce((s, x) => s + Math.max(x, 0), 0);
  const decrease = deltas.reduce((s, x) => s + Math.max(-x, 0), 0);
  const receipt = receipts.get(window.cutoff);
  return {increase, decrease, gross: increase + decrease, net: increase - decrease, deltas,
    receivedAt: latest?.at ?? (receipt?.oi === points.at(-1) ? receipt.at : null)};
}

function percentile80(values) {
  if (values.length < 8) return null;
  values.sort((a, b) => a - b);
  return values[Math.ceil(values.length * .8) - 1];
}

function pastThresholds(window, samples) {
  const previous = new Map(window.recent.filter(b => b.t < window.start && b.sourceComplete !== false).map(b => [b.t, b]));
  const taker = [], oi = [], count = window.bars.length;
  // Compare with the same number of M15 bars from the start of each preceding hour.
  for (let hour = window.start - H1; hour >= window.start - 20 * H1; hour -= H1) {
    const bars = Array.from({length: count}, (_, i) => previous.get(hour + i * M15));
    if (bars.some(b => !b)) continue;
    const flow = takerFlow(bars);
    if (flow) taker.push(Math.abs(flow.net));
    const points = [hour - M15, ...bars.map(b => b.t)].map(t => samples.get(t)?.oi);
    if (points.every(x => Number.isFinite(x) && x > 0)) {
      oi.push(points.slice(1).reduce((s, x, i) => s + Math.abs(100 * Math.log(x / points[i])), 0));
    }
  }
  return {taker: percentile80(taker), oi: percentile80(oi)};
}

export function describeM15Flow(window, {samples, receipts, liveOi, largeTaker, now}) {
  if (!window) return {phase:'WAIT', label:'Chờ dữ liệu', count:0};
  const {start, cutoff, bars, contiguous, live, sourceTime} = window;
  const result = {start, cutoff, sourceTime, live, count:bars.length, phase:'WAIT', direction:0, label:'Thiếu dữ liệu cụm'};
  if (!contiguous) return result;
  if (now - sourceTime >= 2 * M15) return {...result, phase:'STALE', label:'Dữ liệu cũ'};

  const taker = takerFlow(bars);
  const oi = oiFlow(window, samples, receipts, liveOi, now);
  const p95 = cutoff > start ? largeTaker?.(start, cutoff) ?? null : null;
  const threshold = pastThresholds(window, samples);
  const d = Math.sign(taker?.net ?? 0);
  const votes = bars.filter(b => d && Math.sign(takerFlow([b])?.net) === d).length;
  const strongTaker = threshold.taker !== null && taker && Math.abs(taker.ratio) >= .15 &&
    Math.abs(taker.net) > threshold.taker && votes > bars.length / 2;
  const activeOi = threshold.oi !== null && oi && oi.gross > threshold.oi;
  Object.assign(result, {taker, oi, p95, threshold, strongTaker, activeOi});
  if (!taker || !oi) return {...result, label:!taker ? 'Chờ Taker' : 'Chờ OI'};
  if (threshold.taker === null || threshold.oi === null) return {...result, label:'Chờ đủ mẫu nền'};
  if (strongTaker && activeOi) return {...result, phase:d > 0 ? 'BUY' : 'SELL', direction:d, label:d > 0 ? 'Lực mua mạnh' : 'Lực bán mạnh'};
  return {...result, phase:'NEUTRAL', label:'Chưa có lực rõ'};
}
