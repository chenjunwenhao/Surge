import { useCallback } from 'react';

const STORAGE_KEY_LAST_CHECK = 'lastUpdateCheck';
const STORAGE_KEY_SKIPPED = 'skippedVersion';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export default function useUpdateCheck() {

  const checkUpdate = useCallback(async () => {
    try {
      const resp = await fetch('/api/check-update');
      const r = await resp.json();
      if (r.ok) {
        try { localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString()); } catch (_) {}
      }
      return r;
    } catch (e) {
      return { ok: false, error: e.message || 'Network error' };
    }
  }, []);

  const autoCheck = useCallback(async () => {
    try {
      const last = parseInt(localStorage.getItem(STORAGE_KEY_LAST_CHECK) || '0', 10);
      if (Date.now() - last < CHECK_INTERVAL) return null;
      const info = await checkUpdate();
      if (!info.ok || !info.hasUpdate) return null;
      const skipped = localStorage.getItem(STORAGE_KEY_SKIPPED);
      if (skipped === info.latest) return null;
      return info;
    } catch (_) {
      return null;
    }
  }, [checkUpdate]);

  const skipVersion = useCallback((ver) => {
    try { localStorage.setItem(STORAGE_KEY_SKIPPED, ver); } catch (_) {}
  }, []);

  const isSkipped = useCallback((ver) => {
    try { return localStorage.getItem(STORAGE_KEY_SKIPPED) === ver; } catch (_) { return false; }
  }, []);

  return { checkUpdate, autoCheck, skipVersion, isSkipped };
}
