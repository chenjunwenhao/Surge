import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — generic modal with header + body + footer.
 * Supports:
 *   - Simple mode: `message` string + single `onConfirm` button
 *   - Rich mode: `children` for custom body, `buttons` array for multiple actions
 *
 * buttons: [{ label, className?, onClick }]
 */
export default function ConfirmDialog({ show, title, message, children, confirmLabel, buttons, onConfirm, onCancel }) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => btnRef.current?.focus(), 50);
      const onKey = e => { if (e.key === 'Escape') onCancel?.(); };
      document.addEventListener('keydown', onKey);
      return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
    }
  }, [show, onCancel]);

  if (!show) return null;

  const hasButtons = buttons && buttons.length > 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <span>{title || 'Confirm'}</span>
          <button className="btn btn-sm" onClick={onCancel}>&times;</button>
        </div>
        <div className="confirm-dialog-body">
          {children || <p>{message}</p>}
        </div>
        <div className="confirm-dialog-footer">
          {hasButtons ? (
            <>
              <button className="btn" onClick={onCancel}>Cancel</button>
              {buttons.map((b, i) => (
                <button
                  key={i}
                  className={b.className || 'btn btn-danger'}
                  ref={i === buttons.length - 1 ? btnRef : null}
                  onClick={b.onClick}
                >
                  {b.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="btn" onClick={onCancel}>Cancel</button>
              <button className="btn btn-danger" ref={btnRef} onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
