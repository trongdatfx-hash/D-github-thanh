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
  return {increase, decrease, gross: increase + decrease, net: increase - decrease, deltas, sampleTime:latest?.time,
    receivedAt: latest?.at ?? (receipt?.oi === points.at(-1) ? receipt.at : null)};
}

function percentile80(values) {
  if (values.length < 8) return null;
  values.sort((a, b) => a - b);
  return values[Math.ceil(values.length * .8) - 1];
}

function pastThresholds(window, samples) {
  const previous = new Map(window.recent.filter(b => b.t < window.start && b.sourceComplete !== false).map(b => [b.t, b]));
  const taker = [], oi = [], oiNet = [], count = window.bars.length;
  // Compare with the same number of M15 bars from the start of each preceding hour.
  for (let hour = window.start - H1; hour >= window.start - 20 * H1; hour -= H1) {
    const bars = Array.from({length: count}, (_, i) => previous.get(hour + i * M15));
    if (bars.some(b => !b)) continue;
    const flow = takerFlow(bars);
    if (flow) taker.push(Math.abs(flow.net));
    const points = [hour - M15, ...bars.map(b => b.t)].map(t => samples.get(t)?.oi);
    if (points.every(x => Number.isFinite(x) && x > 0)) {
      oi.push(points.slice(1).reduce((s, x, i) => s + Math.abs(100 * Math.log(x / points[i])), 0));
      oiNet.push(Math.abs(100 * Math.log(points.at(-1) / points[0])));
    }
  }
  return {taker: percentile80(taker), oi: percentile80(oi), oiNet: percentile80(oiNet)};
}

// Store one observation per elapsed minute and hour, using the existing live OI feed.
function elapsedOiBaseline(history, window, oi) {
  if (!history || !Number.isFinite(oi?.sampleTime)) return null;
  const minute = Math.floor((oi.sampleTime - window.start) / 60_000);
  if (minute < 0 || minute >= 60) return null;
  const values = [];
  for (const [hour, byMinute] of history) {
    if (hour < window.start - 20 * H1) history.delete(hour);
    else if (hour < window.start && byMinute.has(minute)) values.push(byMinute.get(minute));
  }
  if (!history.has(window.start)) history.set(window.start, new Map());
  const current = history.get(window.start);
  if (!current.has(minute)) current.set(minute, Math.abs(oi.net));
  return percentile80(values);
}

export function describeM15Flow(window, {samples, receipts, liveOi, liveOiHistory, largeTaker, now}) {
  if (!window) return {phase:'WAIT', label:'Chờ dữ liệu', count:0};
  const {start, cutoff, bars, contiguous, live, sourceTime} = window;
  const result = {start, cutoff, sourceTime, live, count:bars.length, phase:'WAIT', direction:0, label:'Thiếu dữ liệu cụm'};
  if (!contiguous) return result;
  if (now - sourceTime >= 2 * M15) return {...result, phase:'STALE', label:'Dữ liệu cũ'};

  const taker = takerFlow(bars);
  const oi = oiFlow(window, samples, receipts, liveOi, now);
  const open = bars[0].o, last = bars.at(-1).c;
  const pricePct = Number.isFinite(open) && open > 0 && Number.isFinite(last) && last > 0
    ? 100 * (last / open - 1) : null;
  const oiPct = oi ? 100 * Math.expm1(oi.net / 100) : null;
  // Suppress ratios that are unstable when buy and sell flows nearly cancel.
  const pricePer100K = pricePct !== null && taker && Math.abs(taker.ratio) >= .10 && Math.abs(taker.net) >= 100_000
    ? pricePct * 100_000 / Math.abs(taker.net) : null;
  const p95 = cutoff > start ? largeTaker?.(start, cutoff) ?? null : null;
  const threshold = pastThresholds(window, samples);
  const d = Math.sign(taker?.net ?? 0);
  const votes = bars.filter(b => d && Math.sign(takerFlow([b])?.net) === d).length;
  const elapsedBaseline = elapsedOiBaseline(liveOiHistory, window, oi);
  const netBaseline = elapsedBaseline ?? threshold.oiNet;
  const rawSell = taker ? Math.max(0, -taker.ratio) : 0;
  const oiRelative = oi && netBaseline > 0 ? Math.abs(oi.net) / netBaseline : 0;
  const multiplier = rawSell >= .10 ? 1 + Math.min(.5, .25 * Math.max(0, oiRelative - 1)) : 1;
  const sellScore = rawSell * multiplier;
  const ratioTrigger = .15;
  const effectiveRatio = d < 0 ? sellScore : taker?.ratio ?? 0;
  const effectiveNet = Math.abs(taker?.net ?? 0) * multiplier;
  const requiredVotes = Math.floor(bars.length / 2) + 1;
  const strongTaker = threshold.taker !== null && taker &&
    effectiveRatio >= ratioTrigger && effectiveNet > threshold.taker && votes >= requiredVotes;
  const takerProgress = !taker || threshold.taker === null ? null : Math.min(
    effectiveRatio / ratioTrigger,
    threshold.taker > 0 ? effectiveNet / threshold.taker : Number(effectiveNet > 0),
    votes / requiredVotes,
    1
  );
  const grossUnusual = threshold.oi !== null && oi && oi.gross > threshold.oi;
  const activeOi = grossUnusual || multiplier > 1;
  Object.assign(result, {taker, oi, p95, pricePct, oiPct, pricePer100K, threshold, strongTaker, activeOi, grossUnusual,
    sellScore, multiplier, netBaseline, elapsedBaseline:elapsedBaseline !== null,
    ratioTrigger, effectiveRatio, effectiveNet, votes, requiredVotes, takerProgress});
  if (!taker || !oi) return {...result, label:!taker ? 'Chờ Taker' : 'Chờ OI'};
  if (threshold.taker === null || threshold.oi === null) return {...result, label:'Chờ đủ mẫu nền'};
  if (strongTaker && activeOi) {
    const oiLabel = multiplier > 1 ? (oi.net > 0 ? ' · OI↑' : ' · Nghi đóng Long') : '';
    return {...result, phase:d > 0 ? 'BUY' : 'SELL', direction:d, label:d > 0 ? 'Lực mua mạnh' : 'Lực bán mạnh' + oiLabel};
  }
  return {...result, phase:'NEUTRAL', label:'Chưa có lực rõ'};
}
