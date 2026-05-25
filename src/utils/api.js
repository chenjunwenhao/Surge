const api = async (path, opts = {}) => {
  const res = await fetch(path, opts);
  return res.json();
};

export default api;
