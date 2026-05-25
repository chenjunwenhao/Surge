import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastId;
    setToasts(p => [...p.slice(-7), { id, message, type, duration, leaving: false }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(p => {
          const found = p.find(t => t.id === id);
          if (!found || found.leaving) return p;
          const updated = p.map(t => t.id === id ? { ...t, leaving: true } : t);
          setTimeout(() => setToasts(q => q.filter(t => t.id !== id)), 300);
          return updated;
        });
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(p => {
      const found = p.find(t => t.id === id);
      if (!found || found.leaving) return p;
      const updated = p.map(t => t.id === id ? { ...t, leaving: true } : t);
      setTimeout(() => setToasts(q => q.filter(t => t.id !== id)), 300);
      return updated;
    });
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
            onClick={() => removeToast(t.id)}>
            <span className="toast-icon">{t.type === 'error' ? '\u2716' : t.type === 'success' ? '\u2714' : t.type === 'warning' ? '\u26A0' : '\u2139'}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
