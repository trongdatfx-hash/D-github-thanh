// Tang gia. Ban v2 chi co Yahoo; Yahoo hay tra 401/429 -> mat luon phan nen.
// Day dung chuoi du phong: Yahoo query1 -> Yahoo query2 -> Stooq CSV.

import { fetchJSON, fetchText } from "./net.js";

const utcDay = (ms) => {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

function parseYahoo(json, { intraday = false } = {}) {
  const res = json?.chart?.result?.[0];
  if (!res) {
    const msg = json?.chart?.error?.description || "cau truc phan hoi la";
    throw new Error(`Yahoo: ${msg}`);
  }
  const ts = res.timestamp || [];
  const q = res.indicators?.quote?.[0] || {};
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].every(Number.isFinite)) {
      // Nen ngay: gom ve moc 00:00 UTC. Nen M30: giu nguyen dau thoi gian.
      out.push({ d: intraday ? new Date(ts[i] * 1000) : utcDay(ts[i] * 1000), o, h, l, c });
    }
  }
  if (!out.length) throw new Error("Yahoo: khong co nen hop le");
  return out;
}

function parseStooqCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^date/i.test(lines[0])) {
    throw new Error(`Stooq: ${lines[0]?.slice(0, 80) || "phan hoi rong"}`);
  }
  const out = [];
  for (const line of lines.slice(1)) {
    const [date, o, h, l, c] = line.split(",");
    const bar = {
      d: new Date(date + "T00:00:00Z"),
      o: Number(o), h: Number(h), l: Number(l), c: Number(c)
    };
    if (!Number.isNaN(bar.d.getTime()) &&
        [bar.o, bar.h, bar.l, bar.c].every(Number.isFinite)) {
      out.push(bar);
    }
  }
  if (!out.length) throw new Error("Stooq: khong doc duoc dong nao");
  return out;
}

/**
 * @returns {{bars:Array<{d:Date,o:number,h:number,l:number,c:number}>,
 *            source:string, attempts:Array<{name:string,ok:boolean,error?:string}>}}
 */
export async function loadDaily(symbol = "SPY", { years = 10 } = {}) {
  const yahooPath =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${years}y&interval=1d&includePrePost=false&events=div%2Csplit`;

  const sources = [
    {
      name: "Yahoo query1",
      run: async () => parseYahoo(await fetchJSON(`https://query1.finance.yahoo.com${yahooPath}`))
    },
    {
      name: "Yahoo query2",
      run: async () => parseYahoo(await fetchJSON(`https://query2.finance.yahoo.com${yahooPath}`))
    },
    {
      name: "Stooq",
      run: async () => parseStooqCSV(await fetchText(
        `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`,
        { accept: "text/csv" }
      ))
    }
  ];

  const attempts = [];
  for (const s of sources) {
    try {
      const bars = await s.run();
      bars.sort((a, b) => a.d - b.d);
      attempts.push({ name: s.name, ok: true });
      return { bars, source: s.name, attempts };
    } catch (e) {
      attempts.push({ name: s.name, ok: false, error: e.message });
    }
  }
  const detail = attempts.map((a) => `${a.name}: ${a.error}`).join(" | ");
  throw new Error(`Tat ca nguon gia deu that bai. ${detail}`);
}

/**
 * Nen trong phien (mac dinh M30). Chi Yahoo co — Stooq khong cung cap intraday
 * mien phi, nen hong thi goi ben ngoai se roi ve nen ngay.
 * Yahoo gioi han: interval 30m chi lay duoc toi da ~60 ngay.
 */
export async function loadIntraday(symbol = "SPY", { interval = "30m", range = "60d" } = {}) {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;

  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  const attempts = [];
  for (const host of hosts) {
    try {
      const bars = parseYahoo(await fetchJSON(host + path), { intraday: true });
      bars.sort((a, b) => a.d - b.d);
      attempts.push({ name: `${host.includes("query1") ? "Yahoo query1" : "Yahoo query2"} ${interval}`, ok: true });
      return { bars, source: `Yahoo ${interval}`, interval, attempts };
    } catch (e) {
      attempts.push({ name: `${host.includes("query1") ? "Yahoo query1" : "Yahoo query2"} ${interval}`, ok: false, error: e.message });
    }
  }
  const err = new Error(attempts.map((a) => a.error).filter(Boolean)[0] || "khong lay duoc nen intraday");
  err.attempts = attempts;
  throw err;
}
