import { useEffect, useState } from 'react';

async function probe(path, okValue) {
  try {
    const res = await fetch(path);
    if (!res.ok) return `Error (${res.status})`;
    const data = await res.json();
    return data.status || okValue;
  } catch {
    return 'Inalcanzable';
  }
}

export default function StatusWidget() {
  const [healthStatus, setHealthStatus] = useState('Verificando...');
  const [readyStatus, setReadyStatus] = useState('Verificando...');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    const [health, ready] = await Promise.all([probe('/api/health', 'ok'), probe('/api/ready', 'ready')]);
    setHealthStatus(health);
    setReadyStatus(ready);
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const healthy = healthStatus === 'ok' && readyStatus === 'ready';

  return (
    <div className="system-status-widget">
      {open && (
        <div className="status-popover">
          <div className="status-popover-header">
            <strong>Estado de la Infraestructura</strong>
            <button className="close-popover-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="status-row">
            <span>Frontend (NGINX):</span>
            <span className="status-tag status-ok">Operativo</span>
          </div>
          <div className="status-row">
            <span>API Backend (/api/health):</span>
            <span className={`status-tag ${healthStatus === 'ok' ? 'status-ok' : 'status-warn'}`}>{healthStatus}</span>
          </div>
          <div className="status-row">
            <span>PostgreSQL (/api/ready):</span>
            <span className={`status-tag ${readyStatus === 'ready' ? 'status-ok' : 'status-warn'}`}>{readyStatus}</span>
          </div>
          <button className="refresh-status-btn" onClick={checkStatus} disabled={loading}>
            {loading ? 'Comprobando...' : 'Actualizar Estado'}
          </button>
        </div>
      )}

      <button className="status-pill-button" onClick={() => setOpen(!open)} title="Ver estado de los servicios">
        <span className={`status-indicator-dot ${healthy ? 'dot-healthy' : 'dot-warning'}`}></span>
        <span className="status-pill-text">Sistema operativo: {healthy ? 'Ok' : 'Verificando'}</span>
      </button>
    </div>
  );
}
