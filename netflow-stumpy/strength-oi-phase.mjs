import {normCDF} from './engine.mjs?v=20261105-spyv-h1-1';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';

const STEP = 900000;
const sign = value => Number.isFinite(value) ? Math.sign(value) : null;
const sum = values => values.reduce((a, b) => a + b, 0);
function smoothNet(values, previous) {
  const net = sum(values), gross = sum(values.map(Math.abs));
  let alpha = .18 + .42 * (gross > 0 ? Math.abs(net) / gross : 0);
  if (previous !== null && net * previous < 0 && Math.abs(net) >= .5 * Math.abs(previous)) alpha = Math.max(alpha, .48);
  return previous === null ? net : previous + alpha * (net - previous);
}

// The continuous 8-bar reference calibrates amplitude independently of phase resets.
// Only the phase impulse window and its smoother reset on a closed SPY-body flip.
export function strengthOiPhase(bars, samples, bodyRows, now) {
  const oi = new Map(samples.map(row => [Number(row.timestamp), Number(row.sumOpenInterest)]));
  const body = new Map(bodyRows.map(row => [row.t, row.adjusted]));
  const changes = [], reference = [], magnitudes = [], impulses = [], points = [];
  let previousTime, referenceSmooth = null, smooth = null, phaseSign = 0, phaseId = 0, phaseBars = 0;
  let pending = null;
  const clearPhase = () => { impulses.length = 0; smooth = null; phaseSign = 0; phaseBars = 0; phaseId++; };
  for (const bar of bars) {
    const time = bar.t / 1000, close = bar.t + STEP, bodySign = sign(body.get(bar.t));
    if (close > now) {
      if (bar.t <= now && phaseSign && bodySign && bodySign !== phaseSign) pending = {time, sign: bodySign};
      points.push({time});
      continue;
    }
    const current = oi.get(close), previous = oi.get(bar.t);
    const valid = current > 0 && previous > 0 && Number.isFinite(current) && Number.isFinite(previous) && bar.sourceComplete !== false;
    if (bar.t !== previousTime || !valid) {
      changes.length = 0; reference.length = 0; referenceSmooth = null; clearPhase();
    }
    previousTime = close;
    if (!valid) { points.push({time}); continue; }
    if (bodySign === null) clearPhase();
    else if (bodySign && bodySign !== phaseSign) { clearPhase(); phaseSign = bodySign; }
    if (phaseSign) phaseBars++;
    const change = current / previous - 1;
    changes.push(Math.abs(change));
    if (changes.length > 20) changes.shift();
    if (changes.length < 20) { points.push({time}); continue; }
    const mean = sum(changes) / 20, impulse = mean > 0 ? change / mean : 0;
    reference.push(impulse); if (reference.length > 8) reference.shift();
    if (phaseSign) { impulses.push(impulse); if (impulses.length > 8) impulses.shift(); smooth = smoothNet(impulses, smooth); }
    if (reference.length < 8) { points.push({time}); continue; }
    referenceSmooth = smoothNet(reference, referenceSmooth);
    magnitudes.push(Math.abs(referenceSmooth)); if (magnitudes.length > 96) magnitudes.shift();
    if (magnitudes.length < 20 || !phaseSign || smooth === null) { points.push({time}); continue; }
    const sigma = sum(magnitudes) / magnitudes.length * Math.sqrt(Math.PI / 2);
    points.push({time, value: sigma > 0 ? Math.max(-1, Math.min(1, 2 * normCDF(smooth / sigma) - 1)) : 0,
      phaseId, phaseSign, phaseBars, count: impulses.length});
  }
  return {points, pending};
}

// Draw segments explicitly: missing OI and phase boundaries must never be bridged.
export function oiPhasePrimitive(chart, series) {
  let state = {points: [], pending: null}, enabled = false;
  const primitive = new SpectrumPrimitive(({context: ctx, mediaSize: {width, height}}) => {
    if (!enabled) return;
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    const xOf = time => chart.timeScale().timeToCoordinate(time);
    const yOf = value => series.priceToCoordinate(value);
    const zero = yOf(0);
    let previous = null;
    for (const point of state.points) {
      if (!Number.isFinite(point.value)) { previous = null; continue; }
      const x = xOf(point.time), y = yOf(point.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { previous = null; continue; }
      const color = point.value >= 0 ? '#70b7ff' : '#f08aff';
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
      if (previous && previous.phaseId === point.phaseId) {
        const [px, py] = previous.xy;
        ctx.beginPath(); ctx.moveTo(px, py);
        if (previous.value * point.value < 0) {
          const cross = px + (x - px) * Math.abs(previous.value) / (Math.abs(previous.value) + Math.abs(point.value));
          ctx.strokeStyle = previous.value >= 0 ? '#70b7ff' : '#f08aff';
          ctx.lineTo(cross, zero); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cross, zero); ctx.strokeStyle = color;
        }
        ctx.lineTo(x, y); ctx.stroke();
      } else if (point.phaseBars === 1 && Number.isFinite(zero)) {
        ctx.beginPath(); ctx.arc(x, zero, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      if (!previous || previous.phaseId !== point.phaseId) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      previous = {...point, xy: [x, y]};
    }
    if (state.pending && Number.isFinite(zero)) {
      const x = xOf(state.pending.time);
      if (Number.isFinite(x)) {
        ctx.strokeStyle = '#d3dfed'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x - 6, zero); ctx.lineTo(x + 6, zero); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  });
  series.attachPrimitive(primitive);
  return {setData(next, visible) { state = next; enabled = visible; primitive.redraw(); }};
}
