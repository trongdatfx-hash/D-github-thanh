const M15 = 900_000;
const H1 = 4 * M15;
const FLOW_GATE = 0.10;

function isClosed(bar, now) {
  return bar && bar.sourceComplete !== false && bar.end === bar.t + M15 - 1 &&
    bar.end < now && [bar.o, bar.h, bar.l, bar.c].every(Number.isFinite);
}

export function m15FlowWindow(rows, priceNow) {
  const last = rows.findLastIndex(bar => isClosed(bar, priceNow));
  if (last < 0) return null;
  const cutoff = rows[last].t + M15;
  const start = Math.floor(rows[last].t / H1) * H1;
  const recent = rows.slice(Math.max(0, last - 39), last + 1);
  const expected = (cutoff - start) / M15;
  const bars = recent.filter(bar => bar.t >= start && isClosed(bar, priceNow));
  const contiguous = bars.length === expected && bars.every((bar, i) => bar.t === start + i * M15);
  return {start, cutoff, recent, bars, contiguous};
}

function bounds(bars) {
  return {low: Math.min(...bars.map(b => b.l)), high: Math.max(...bars.map(b => b.h))};
}

function takerFlow(bars) {
  if (bars.some(b => !Number.isFinite(b.q) || !Number.isFinite(b.buy) ||
    b.q < 0 || b.buy < 0 || b.buy > b.q)) return null;
  const total = bars.reduce((sum, b) => sum + b.q, 0);
  if (!total) return null;
  const buy = bars.reduce((sum, b) => sum + b.buy, 0);
  const ratio = (2 * buy - total) / total;
  return {buy, sell: total - buy, ratio, direction: Math.abs(ratio) >= FLOW_GATE ? Math.sign(ratio) : 0};
}

function oiFlow(window, samples, receipts) {
  const points = [window.start - M15, ...window.bars.map(bar => bar.t)].map(t => samples.get(t));
  if (points.some(p => !Number.isFinite(p?.oi) || p.oi <= 0)) return null;
  const deltas = points.slice(1).map((p, i) => 100 * Math.log(p.oi / points[i].oi));
  const net = deltas.reduce((sum, x) => sum + x, 0);
  const gross = deltas.reduce((sum, x) => sum + Math.abs(x), 0);
  const baseline = [];
  for (let t = window.start - M15; baseline.length < 20; t -= M15) {
    const pair = [samples.get(t)?.oi, samples.get(t - M15)?.oi];
    if (pair.some(x => !Number.isFinite(x) || x <= 0)) break;
    baseline.push(Math.abs(100 * Math.log(pair[0] / pair[1])));
  }
  const meanAbsolute = baseline.length >= 8 ? baseline.reduce((s, x) => s + x, 0) / baseline.length : null;
  const threshold = meanAbsolute === null ? null : meanAbsolute * Math.sqrt(deltas.length);
  const direction = threshold !== null && Math.abs(net) > threshold && Math.abs(net) >= gross / 2 ? Math.sign(net) : 0;
  const receipt = receipts.get(window.cutoff);
  const peak = deltas.reduce((i, delta, j) => Math.abs(delta) > Math.abs(deltas[i]) ? j : i, 0);
  return {net, deltas, direction, threshold, peakPrice: window.bars[peak].c,
    receivedAt: receipt?.oi === points.at(-1).oi ? receipt.at : null};

}

function rejectedFlow(bars, zone, noiseFloor, taker) {
  if (!zone || !taker?.direction || bars.length < 3) return 0;
  const d = taker.direction;
  const boundary = d > 0 ? zone.high : zone.low;
  const near = Math.max(noiseFloor, Number.EPSILON);
  const touches = bars.filter(bar =>
    takerFlow([bar])?.direction === d &&
    Math.abs((d > 0 ? bar.h : bar.l) - boundary) <= near);
  return touches.length >= 2 && d * (bars.at(-1).c - boundary) < -near ? d : 0;
}

export function describeM15Flow(window, {reference, groupSize, samples, receipts, largeTaker, now}) {
  if (!window) return {phase:'WAIT', label:'Chờ nến đóng', count:0};
  const {start, cutoff, recent, bars, contiguous} = window;
  const count = bars.length;
  const result = {start, cutoff, count, phase:'WAIT', label:'Thiếu nến liên tục', direction:0};
  if (!contiguous) return result;

  const previous = recent.filter(bar => bar.t < start);
  const priorGroup = previous.slice(-4 * groupSize);
  const zone = priorGroup.length === 4 * groupSize &&
    priorGroup.every((bar, i) => bar.t === start - (priorGroup.length - i) * M15 && isClosed(bar, start))
    ? bounds(priorGroup) : null;
  const ranges = previous.slice(-20).filter(bar => isClosed(bar, start)).map(bar => bar.h - bar.l).sort((a, b) => a - b);
  const noiseFloor = ranges.length >= 8 ? 0.5 * ranges[Math.floor(ranges.length / 2)] : 0;
  const {high, low} = bounds(bars);
  const move = bars.at(-1).c - bars[0].o;
  const priceDirection = Math.abs(move) > 0 && Math.abs(move) >= Math.max(0.25 * (high - low), noiseFloor)
    ? Math.sign(move) : 0;
  const tail = bars.slice(-2);
  const broke = zone && tail.length === 2
    ? (tail.every(b => b.c > zone.high) ? 1 : tail.every(b => b.c < zone.low) ? -1 : 0)
    : 0;
  const h1 = reference?.to === start ? reference.baseDirection ?? 0 : 0;
  const taker = takerFlow(bars);
  const oi = oiFlow(window, samples, receipts);
  const p95 = largeTaker?.(start, cutoff) ?? null;
  const p95Direction = p95?.ready && p95.count >= 5 && p95.maxTrade <= (p95.buy + p95.sell) / 2 &&
    Math.abs(p95.ratio) >= FLOW_GATE ? Math.sign(p95.ratio) : 0;
  const conflict = Boolean(priceDirection && taker?.direction === -priceDirection);
  const againstH1 = Boolean(h1 && priceDirection === -h1);
  const absorption = (!priceDirection || conflict) ? rejectedFlow(bars, zone, noiseFloor, taker) : 0;
  Object.assign(result, {move, priceDirection, zone, h1, taker, oi, p95, p95Direction, conflict, againstH1, absorption});

  const priceLabel = priceDirection > 0 ? 'Tăng có lực mua' : 'Giảm có lực bán';
  const oiLabel = oi?.direction > 0 ? 'OI mở rộng' : oi?.direction < 0 ? 'OI co lại' : oi ? 'OI chưa rõ' : 'OI chờ';
  if (now - cutoff >= 2 * M15) return {...result, phase:'STALE', label:'Dữ liệu cũ'};
  if (broke) return {...result, phase:'BREAKOUT', direction:broke, label:'Phá biên · xác nhận 2 M15'};
  if (count < 3) return {...result, label:'Chờ 3 nến đóng'};
  if (againstH1) return {...result, phase:'AGAINST_H1', label:'WAIT · Ngược H1'};
  if (absorption) return {...result, phase:'ABSORPTION', label:absorption > 0 ? 'Nghi lực mua bị hấp thụ' : 'Nghi lực bán bị hấp thụ'};
  if (conflict) return {...result, phase:'CONFLICT', label:'Giá–Taker xung đột'};
  if (priceDirection && taker?.direction === priceDirection) {
    return {...result, phase:'SUPPORTED', direction:priceDirection, label:priceLabel + ' · ' + oiLabel};
  }
  if (!priceDirection) return {...result, phase:'MIXED', label:'Giá lưỡng lự'};
  return {...result, label:taker ? 'WAIT · Taker chưa rõ' : 'WAIT · Taker thiếu'};
}
