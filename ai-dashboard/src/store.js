// chrome.storage khi chay nhu extension, localStorage khi mo file truc tiep
// de test. Nho vay dashboard.html van chay duoc ngoai Chrome extension.

const hasChrome = typeof chrome !== "undefined" && chrome?.storage?.local;

export const store = {
  async get(key, fallback = null) {
    try {
      if (hasChrome) {
        const r = await chrome.storage.local.get(key);
        return r[key] ?? fallback;
      }
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      if (hasChrome) return void (await chrome.storage.local.set({ [key]: value }));
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* het dung luong -> bo qua, cache khong bat buoc */ }
  }
};

export const CACHE_KEY  = "cot_cache_v3";
export const PREFS_KEY  = "cot_prefs_v3";
export const IMPORT_KEY = "cot_import_v3"; // du lieu nhap tay, uu tien hon mang khi co
