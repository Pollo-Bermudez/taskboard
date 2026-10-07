import { OfflineIcon } from './Icons.jsx';

export function LaneSkeleton() {
  return (
    <div role="status" aria-label="Cargando tareas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1].map((i) => (
        <div key={i} className="card elev-sm" style={{ gap: 8, padding: 12 }}>
          <div className="skel" style={{ width: '30%', height: 8 }} />
          <div className="skel" style={{ width: '80%', height: 12 }} />
          <div className="skel soft" style={{ width: '95%', height: 8 }} />
          <div className="skel soft" style={{ width: '60%', height: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, conDatos }) {
  return (
    <div role="alert" className="card elev-sm" style={{ gap: 10, padding: 14, maxWidth: 520 }}>
      <div className="eyebrow">
        <OfflineIcon style={{ color: 'var(--color-accent-300)' }} />
        <h5 style={{ margin: 0 }}>No pudimos cargar las tareas</h5>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        El servidor no responde. Reintentaremos en 15 segundos{conDatos ? '; lo que ves puede estar desactualizado' : ''}.
      </p>
      <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', minHeight: 36, padding: '0 14px' }} onClick={onRetry}>
        Reintentar ahora
      </button>
    </div>
  );
}
