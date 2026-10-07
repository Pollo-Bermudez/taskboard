import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { TrashIcon } from './Icons.jsx';

export default function ConfirmDialog({ tarea, equipoNombre, onConfirmar, onCancelar }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Dialog role="alertdialog" labelledBy="confirm-titulo" describedBy="confirm-texto" onClose={onCancelar}>
      <div className="eyebrow" style={{ gap: 12 }}>
        <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: 'var(--color-accent-900)', boxShadow: '0 0 0 1px var(--color-accent-700)', color: 'var(--color-accent-300)' }}>
          <TrashIcon size={18} />
        </span>
        <h2 id="confirm-titulo" className="dialog-title" style={{ margin: 0 }}>¿Eliminar esta tarea?</h2>
      </div>
      <div id="confirm-texto" className="dialog-body">
        <p style={{ margin: '0 0 8px' }}>
          <strong style={{ fontWeight: 500 }}>{tarea.titulo}</strong> desaparecerá del tablero de {equipoNombre} y de la vista global.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Esta acción no se puede deshacer.</p>
      </div>
      {error && <div className="notice-alert" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" style={{ minHeight: 38, padding: '0 14px' }} onClick={onCancelar} data-autofocus>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" style={{ minHeight: 38, padding: '0 16px' }} onClick={confirmar} disabled={enviando}>
          {enviando ? 'Eliminando…' : 'Eliminar tarea'}
        </button>
      </div>
    </Dialog>
  );
}
