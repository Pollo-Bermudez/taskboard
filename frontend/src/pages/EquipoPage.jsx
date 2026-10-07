import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { ESTADOS, POLLING_MS } from '../constants.js';
import TaskCard from '../components/TaskCard.jsx';
import TaskForm from '../components/TaskForm.jsx';

export default function EquipoPage() {
  const { id } = useParams();
  const equipoId = Number(id);
  const { usuario } = useAuth();
  const editable = usuario.equipo_id === equipoId;

  const cargar = useCallback(async () => {
    const [equipos, tareas, usuarios] = await Promise.all([
      api('/equipos'),
      api(`/tareas?equipo_id=${equipoId}`),
      api(`/equipos/${equipoId}/usuarios`),
    ]);
    return { equipo: equipos.find((e) => e.id === equipoId), tareas, usuarios };
  }, [equipoId]);

  const { data, error, refresh } = usePolling(cargar, POLLING_MS);
  const [formulario, setFormulario] = useState(null); // null | { tarea?: object }
  const [accionError, setAccionError] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);

  const ejecutar = async (accion) => {
    setAccionError(null);
    try {
      await accion();
      await refresh();
    } catch (err) {
      setAccionError(err.message);
    }
  };

  const guardar = async (datos) => {
    const tarea = formulario?.tarea;
    if (tarea) {
      await api(`/tareas/${tarea.id}`, { method: 'PATCH', body: datos });
    } else {
      await api('/tareas', { method: 'POST', body: datos });
    }
    setFormulario(null);
    await refresh();
  };

  const mover = (tarea, estado) =>
    tarea.estado !== estado && ejecutar(() => api(`/tareas/${tarea.id}`, { method: 'PATCH', body: { estado } }));

  const borrar = (tarea) => {
    if (window.confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) {
      ejecutar(() => api(`/tareas/${tarea.id}`, { method: 'DELETE' }));
    }
  };

  if (!Number.isInteger(equipoId) || (data && !data.equipo)) {
    return (
      <main className="board-container">
        <h2 className="board-title">Equipo no encontrado</h2>
        <Link to="/global">Ir a la vista global</Link>
      </main>
    );
  }

  return (
    <main className="board-container">
      <div className="board-header">
        <div>
          <h2 className="board-title">
            {data?.equipo && <span className="team-dot" style={{ background: data.equipo.color_hex }}></span>}
            {data?.equipo?.nombre || 'Tablero de equipo'}
          </h2>
          <p className="board-description">
            {editable ? 'Tablero de tu equipo. Arrastra las tarjetas para cambiar su estado.' : 'Tablero de otro equipo: solo lectura.'}
          </p>
        </div>
        {editable && (
          <div className="board-actions">
            <button className="btn-primary" onClick={() => setFormulario({})}>
              + Nueva tarea
            </button>
          </div>
        )}
      </div>

      {!editable && <div className="alert alert-info">Solo el equipo propietario puede modificar estas tareas.</div>}
      {error && <div className="alert alert-error">No se pudieron cargar las tareas: {error.message}</div>}
      {accionError && <div className="alert alert-error">{accionError}</div>}

      <div className="kanban-grid">
        {ESTADOS.map((col) => {
          const tareas = data?.tareas.filter((t) => t.estado === col.key) || [];
          return (
            <div
              key={col.key}
              className={`kanban-column ${arrastrando && editable ? 'drop-target' : ''}`}
              onDragOver={editable ? (e) => e.preventDefault() : undefined}
              onDrop={
                editable
                  ? (e) => {
                      e.preventDefault();
                      const tarea = data.tareas.find((t) => t.id === Number(e.dataTransfer.getData('text/plain')));
                      setArrastrando(null);
                      if (tarea) mover(tarea, col.key);
                    }
                  : undefined
              }
            >
              <div className="column-header">
                <div className="column-title-group">
                  <h3 className="column-title">{col.titulo}</h3>
                  <span className={`column-count ${col.badge}`}>{tareas.length}</span>
                </div>
              </div>
              <div className="column-cards">
                {tareas.map((t) => {
                  const idx = ESTADOS.findIndex((e) => e.key === t.estado);
                  return (
                    <div
                      key={t.id}
                      draggable={editable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(t.id));
                        setArrastrando(t.id);
                      }}
                      onDragEnd={() => setArrastrando(null)}
                      className={editable ? 'draggable' : undefined}
                    >
                      <TaskCard tarea={t}>
                        {editable && (
                          <div className="card-actions">
                            <button
                              className="icon-btn"
                              title="Mover a la columna anterior"
                              aria-label="Mover a la columna anterior"
                              disabled={idx === 0}
                              onClick={() => mover(t, ESTADOS[idx - 1].key)}
                            >
                              ←
                            </button>
                            <button
                              className="icon-btn"
                              title="Mover a la columna siguiente"
                              aria-label="Mover a la columna siguiente"
                              disabled={idx === ESTADOS.length - 1}
                              onClick={() => mover(t, ESTADOS[idx + 1].key)}
                            >
                              →
                            </button>
                            <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setFormulario({ tarea: t })}>
                              ✎
                            </button>
                            <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => borrar(t)}>
                              🗑
                            </button>
                          </div>
                        )}
                      </TaskCard>
                    </div>
                  );
                })}
                {data && tareas.length === 0 && <p className="muted empty-column">Sin tareas</p>}
              </div>
            </div>
          );
        })}
      </div>

      {formulario && (
        <TaskForm tarea={formulario.tarea} usuarios={data?.usuarios || []} onGuardar={guardar} onCancelar={() => setFormulario(null)} />
      )}
    </main>
  );
}
