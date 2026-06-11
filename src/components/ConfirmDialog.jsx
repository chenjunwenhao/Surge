import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ show, title, message, confirmLabel, onConfirm, onCancel }) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => btnRef.current?.focus(), 50);
      const onKey = e => { if (e.key === 'Escape') onCancel(); };
      document.addEventListener('keydown', onKey);
      return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
    }
  }, [show, onCancel]);

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <span>{title}</span>
          <button className="btn btn-sm" onClick={onCancel}>&times;</button>
        </div>
        <div className="confirm-dialog-body">
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" ref={btnRef} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
