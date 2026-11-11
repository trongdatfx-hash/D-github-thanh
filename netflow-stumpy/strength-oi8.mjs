import {normCDF} from './engine.mjs?v=20261105-spyv-h1-1';

const STEP = 900000;

export function strengthOi8(bars, samples, now) {
  const oi = new Map(samples.map(row => [Number(row.timestamp), Number(row.sumOpenInterest)]));
  const magnitudes = [];
  let previousTime, changes = [], impulses = [], smooth = null;

  return bars.map(bar => {
    const time = bar.t / 1000;
    const close = bar.t + STEP;
    const current = oi.get(close);
    const previous = oi.get(bar.t);
    if (close > now) return {time};
    if (bar.t !== previousTime || !(current > 0 && previous > 0)
        || !Number.isFinite(current) || !Number.isFinite(previous) || bar.sourceComplete === false) {
      changes = [];
      impulses = [];
      smooth = null;
    }
    previousTime = close;
    if (!(current > 0 && previous > 0) || !Number.isFinite(current)
        || !Number.isFinite(previous) || bar.sourceComplete === false) return {time};

    const change = current / previous - 1;
    changes.push(Math.abs(change));
    if (changes.length > 20) changes.shift();
    if (changes.length < 20) return {time};
    const mean = changes.reduce((sum, value) => sum + value, 0) / 20;
    impulses.push(mean > 0 ? change / mean : 0);
    if (impulses.length > 8) impulses.shift();
    if (impulses.length < 8) return {time};

    const net = impulses.reduce((sum, value) => sum + value, 0);
    const gross = impulses.reduce((sum, value) => sum + Math.abs(value), 0);
    let alpha = .18 + .42 * (gross > 0 ? Math.abs(net) / gross : 0);
    if (smooth !== null && net * smooth < 0 && Math.abs(net) >= .5 * Math.abs(smooth)) alpha = Math.max(alpha, .48);
    smooth = smooth === null ? net : smooth + alpha * (net - smooth);
    magnitudes.push(Math.abs(smooth));
    if (magnitudes.length > 96) magnitudes.shift();
    if (magnitudes.length < 20) return {time};
    const sigma = magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length * Math.sqrt(Math.PI / 2);
    return {time, value: sigma > 0 ? Math.max(-1, Math.min(1, 2 * normCDF(smooth / sigma) - 1)) : 0};
  });
}
