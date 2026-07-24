import { useEffect, useRef, useState, useCallback } from 'react';

const PHASE = { INFO: 1, DOWNLOADING: 2, READY: 3, ERROR: 4 };

export default function UpdateModal({ info, onClose, onSkip, toast }) {
  const [phase, setPhase] = useState(PHASE.INFO);
  const [progress, setProgress] = useState({ percent: 0, downloaded: '', total: '' });
  const [error, setError] = useState('');
  const eventSourceRef = useRef(null);
  const btnRef = useRef(null);
  const extractedPathRef = useRef(null);
  const finishedRef = useRef(false);

  // Focus primary button on mount
  useEffect(() => {
    const t = setTimeout(() => btnRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [phase]);

  // Esc to close (only in info/error phase)
  useEffect(() => {
    if (phase !== PHASE.INFO && phase !== PHASE.ERROR) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      const es = eventSourceRef.current;
      if (es) { es.close(); eventSourceRef.current = null; }
    };
  }, []);

  const startDownload = useCallback(() => {
    if (!info.zipUrl) {
      setError('No download available for this platform');
      setPhase(PHASE.ERROR);
      return;
    }
    setPhase(PHASE.DOWNLOADING);
    setError('');
    finishedRef.current = false;

    const url = `/api/download-update?url=${encodeURIComponent(info.zipUrl)}&version=${encodeURIComponent(info.latest)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const finish = () => {
      finishedRef.current = true;
      es.close();
      eventSourceRef.current = null;
    };

    es.addEventListener('progress', (e) => {
      try { setProgress(JSON.parse(e.data)); } catch (_) {}
    });

    es.addEventListener('complete', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.ok) {
          extractedPathRef.current = d.extractedPath;
          setPhase(PHASE.READY);
        } else {
          setError(d.error || 'Download failed');
          setPhase(PHASE.ERROR);
        }
      } catch (_) {
        setError('Unexpected response from server');
        setPhase(PHASE.ERROR);
      }
      finish();
    });

    // Fired both for server-sent `event: error` (with data) and
    // native SSE connection failures (no data).
    es.addEventListener('error', (e) => {
      if (finishedRef.current) return;
      let msg = '';
      try {
        if (e.data) {
          const d = JSON.parse(e.data);
          if (d.error) msg = d.error;
        }
      } catch (_) {}
      setError(msg || 'Download failed — check your network');
      setPhase(PHASE.ERROR);
      finish();
    });
  }, [info]);

  const handleCancel = useCallback(() => {
    const es = eventSourceRef.current;
    if (es) { es.close(); eventSourceRef.current = null; }
    onClose();
  }, [onClose]);

  const handleRestart = useCallback(() => {
    try {
      if (window.electronAPI?.quitAndInstall) {
        window.electronAPI.quitAndInstall(extractedPathRef.current);
      } else {
        // Fallback: browser mode, just close modal
        toast('Please restart Surge manually after installing the update.', 'warning');
        onClose();
      }
    } catch (e) {
      toast('Restart failed: ' + (e.message || String(e)), 'error');
    }
  }, [onClose, toast]);

  if (!info) return null;

  return (
    <div className="modal-overlay" onClick={phase === PHASE.INFO || phase === PHASE.ERROR ? onClose : undefined}>
      <div className="update-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="update-modal-header">
          <span>
            {phase === PHASE.INFO && 'New Version Available'}
            {phase === PHASE.DOWNLOADING && 'Downloading Update'}
            {phase === PHASE.READY && 'Ready to Install'}
            {phase === PHASE.ERROR && 'Update Failed'}
          </span>
          {(phase === PHASE.INFO || phase === PHASE.ERROR) && (
            <button className="btn btn-sm" onClick={onClose}>&times;</button>
          )}
        </div>

        {/* Body */}
        <div className="update-modal-body">
          {phase === PHASE.INFO && (
            <div className="update-info">
              <div className="update-version-row">
                <span className="update-current">v{info.current}</span>
                <span className="update-arrow">&rarr;</span>
                <span className="update-latest">v{info.latest}</span>
              </div>
              {info.publishedAt && (
                <div className="update-date">
                  Released: {new Date(info.publishedAt).toLocaleDateString()}
                </div>
              )}
              {info.notes && (
                <pre className="release-notes">{info.notes}</pre>
              )}
              {info.pageUrl && (
                <a className="update-changelog-link" href={info.pageUrl} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}>
                  View full changelog &rarr;
                </a>
              )}
            </div>
          )}

          {phase === PHASE.DOWNLOADING && (
            <div className="update-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: progress.percent + '%' }} />
              </div>
              <div className="progress-text">
                {progress.percent > 0 && !progress.extracting ? `${progress.percent}%` : ''}
                {progress.extracting ? 'Extracting...' : ''}
                {progress.percent === 0 && !progress.extracting ? 'Connecting...' : ''}
              </div>
              {progress.downloaded && <div className="progress-size">{progress.downloaded} / {progress.total}</div>}
            </div>
          )}

          {phase === PHASE.READY && (
            <div className="update-ready">
              <p>Surge will quit, update to <strong>v{info.latest}</strong>, and reopen automatically.</p>
              <p className="text-muted">All connections, tabs, and settings will be preserved.</p>
            </div>
          )}

          {phase === PHASE.ERROR && (
            <div className="update-error">
              <p>{error || 'An unexpected error occurred.'}</p>
              {info.pageUrl && (
                <p className="text-muted">
                  You can also download manually from{' '}
                  <a href={info.pageUrl} target="_blank" rel="noopener noreferrer">GitHub Releases</a>.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="update-modal-footer">
          {phase === PHASE.INFO && (
            <>
              <button className="btn" onClick={onClose}>Later</button>
              <button className="btn" onClick={() => { onSkip?.(info.latest); }}>Skip This Version</button>
              <button className="btn btn-accent" ref={btnRef} onClick={startDownload} disabled={!info.zipUrl}
                title={!info.zipUrl ? 'No download available for this platform' : ''}>
                Update Now
              </button>
            </>
          )}
          {phase === PHASE.DOWNLOADING && (
            <button className="btn" onClick={handleCancel}>Cancel</button>
          )}
          {phase === PHASE.READY && (
            <button className="btn btn-accent" ref={btnRef} onClick={handleRestart}>Restart Now</button>
          )}
          {phase === PHASE.ERROR && (
            <>
              <button className="btn" onClick={onClose}>Close</button>
              {info.pageUrl && (
                <button className="btn btn-accent" ref={btnRef} onClick={() => {
                  window.open(info.pageUrl, '_blank', 'noopener,noreferrer');
                  onClose();
                }}>
                  Download Manually
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
