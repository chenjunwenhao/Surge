const api = async (path, opts = {}) => {
  const res = await fetch(path, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
  }
};

export default api;
