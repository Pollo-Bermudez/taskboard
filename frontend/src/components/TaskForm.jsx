import { useState } from 'react';
import { ESTADOS, PRIORIDADES } from '../constants.js';

const VACIA = { titulo: '', descripcion: '', estado: 'pendiente', prioridad: 'media', asignado_a: '' };

export default function TaskForm({ tarea, usuarios, onGuardar, onCancelar }) {
  const [form, setForm] = useState(() =>
    tarea
      ? {
          titulo: tarea.titulo,
          descripcion: tarea.descripcion || '',
          estado: tarea.estado,
          prioridad: tarea.prioridad,
          asignado_a: tarea.asignado_a ?? '',
        }
      : VACIA,
  );
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
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
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <form className="modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <h3 id="task-form-title" className="modal-title">
          {tarea ? 'Editar tarea' : 'Nueva tarea'}
        </h3>
        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Título</span>
          <input value={form.titulo} onChange={set('titulo')} maxLength={200} required autoFocus />
        </label>
        <label className="field">
          <span>Descripción</span>
          <textarea value={form.descripcion} onChange={set('descripcion')} rows={3} maxLength={5000} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Estado</span>
            <select value={form.estado} onChange={set('estado')}>
              {ESTADOS.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prioridad</span>
            <select value={form.prioridad} onChange={set('prioridad')}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Responsable</span>
          <select value={form.asignado_a} onChange={set('asignado_a')}>
            <option value="">Sin asignar</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
