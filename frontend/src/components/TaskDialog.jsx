import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { WarningIcon, XIcon } from './Icons.jsx';
import { ESTADOS, PRIORIDADES } from '../constants.js';

const VACIA = { titulo: '', descripcion: '', estado: 'pendiente', prioridad: 'media', asignado_a: '' };

export default function TaskDialog({ tarea, equipoNombre, usuarios, onGuardar, onCancelar }) {
  const [form, setForm] = useState(() =>
    tarea
      ? { titulo: tarea.titulo, descripcion: tarea.descripcion || '', estado: tarea.estado, prioridad: tarea.prioridad, asignado_a: tarea.asignado_a ?? '' }
      : VACIA,
  );
  const [error, setError] = useState(null);
  const [tituloVacio, setTituloVacio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setTituloVacio(true);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        estado: form.estado,
        prioridad: form.prioridad,
        asignado_a: form.asignado_a === '' ? null : Number(form.asignado_a),
      });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Dialog as="form" className="dialog-wide" labelledBy="tarea-titulo" onClose={onCancelar} onSubmit={onSubmit} noValidate>
      <div className="dialog-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h6 className="muted">{equipoNombre}</h6>
          <h2 id="tarea-titulo" className="dialog-title">{tarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
        </div>
        <button type="button" className="btn btn-icon icon-btn" aria-label="Cerrar" style={{ width: 32, height: 32 }} onClick={onCancelar}>
          <XIcon />
        </button>
      </div>

      {error && (
        <div className="notice-alert" role="alert">
          <WarningIcon /> {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="tarea-campo-titulo">Título</label>
        <input id="tarea-campo-titulo" className="input" value={form.titulo} maxLength={200} style={{ minHeight: 40 }}
          aria-invalid={tituloVacio || undefined} aria-describedby={tituloVacio ? 'tarea-titulo-error' : undefined}
          onChange={(e) => { setTituloVacio(false); set('titulo')(e); }} data-autofocus />
        {tituloVacio && <div id="tarea-titulo-error" className="field-error">El título es obligatorio.</div>}
      </div>
      <div className="field">
        <label htmlFor="tarea-campo-desc">Descripción <span className="muted">(opcional)</span></label>
        <textarea id="tarea-campo-desc" className="input" rows={3} maxLength={5000} value={form.descripcion} onChange={set('descripcion')} />
      </div>
      <div className="field">
        <label id="tarea-prioridad">Prioridad</label>
        <div className="seg" role="radiogroup" aria-labelledby="tarea-prioridad">
          {PRIORIDADES.map((p) => (
            <label key={p} className="seg-opt">
              <input type="radio" name="prioridad" value={p} checked={form.prioridad === p} onChange={set('prioridad')} />
              {p[0].toUpperCase() + p.slice(1)}
            </label>
          ))}
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tarea-campo-estado">Estado</label>
          <select id="tarea-campo-estado" className="input" style={{ minHeight: 40 }} value={form.estado} onChange={set('estado')}>
            {ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.titulo}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tarea-campo-resp">Responsable</label>
          <select id="tarea-campo-resp" className="input" style={{ minHeight: 40 }} value={form.asignado_a} onChange={set('asignado_a')}>
            <option value="">Sin responsable</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Solo aparecen miembros de {equipoNombre}.</p>

      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" style={{ minHeight: 38, padding: '0 14px' }} onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ minHeight: 38, padding: '0 16px' }} disabled={guardando}>
          {guardando ? 'Guardando…' : tarea ? 'Guardar cambios' : 'Crear tarea'}
        </button>
      </div>
    </Dialog>
  );
}
