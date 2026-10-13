// Lop mang dung chung: timeout that su (AbortController) + retry co backoff.
// Ban v2 dung fetch tran, mot lan nghen mang la ca dashboard chet im.

/** Rut gon body loi: bo the HTML, giu cau chu de biet ai dang chan. */
export function summariseBody(body) {
  if (!body) return "";
  const text = String(body)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 160);
}

export class HttpError extends Error {
  constructor(status, url, body) {
    const gist = summariseBody(body);
    super(`HTTP ${status}${gist ? ` «${gist}»` : ""} — ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
    this.gist = gist;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {{timeout?:number, retries?:number, accept?:string, signal?:AbortSignal}} opts
 * @returns {Promise<string>} body dang text
 */
export async function fetchText(url, opts = {}) {
  const {
    timeout = 20000, retries = 2, accept = "application/json",
    headers = {}, backoff = 800
  } = opts;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: accept, ...headers },
        cache: "no-store"
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HttpError(res.status, url, body.slice(0, 2000));
      }
      return await res.text();
    } catch (err) {
      lastErr = err.name === "AbortError"
        ? new Error(`Timeout sau ${timeout}ms — ${url}`)
        : err;

      // 403 tu Socrata thuong la CHAN TOC DO (goi qua nhieu / qua nang), khong
      // phai "cam vinh vien" — nen van dang retry. Cac 4xx khac thi retry vo nghia.
      const status = err instanceof HttpError ? err.status : 0;
      const worthRetrying =
        status === 0 || status === 403 || status === 429 || status >= 500;
      if (attempt === retries || !worthRetrying) break;

      await sleep(backoff * Math.pow(2, attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchJSON(url, opts) {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Phan hoi khong phai JSON tu ${url}: ${text.slice(0, 120)}`);
  }
}
