const api = async (path, opts = {}) => {
  const { timeout = 30000, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(path, { ...fetchOpts, signal: controller.signal });
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
    }
  } finally {
    clearTimeout(timer);
  }
};

export default api;
